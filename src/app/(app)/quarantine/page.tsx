import { ShieldAlert } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { addHostAquariumItemsToQuarantineProject, createQuarantineProject, updateQuarantineItemStatus, updateQuarantineProjectStatus } from "@/domains/management/actions";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { CreatePanel } from "@/components/forms/CreatePanel";
import { CreateSubmitActions } from "@/components/forms/CreateSubmitActions";
import { QuarantineItemPicker, type QuarantinePickerOption } from "@/components/quarantine/QuarantineItemPicker";

export const dynamic = "force-dynamic";

function quantityLabel(item: { quantity: number; unit?: string | null }) {
  const quantity = Number.isInteger(item.quantity) ? String(item.quantity) : item.quantity.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return `${quantity} ${item.unit ?? "units"}`.trim();
}

function itemTypeLabel(itemType: string) {
  return itemType.toLowerCase().replaceAll("_", " ");
}

function placementLabel(item: any) {
  const attachedAquariums = item.aquariumAttachments?.map((attachment: any) => attachment.aquarium.name).filter(Boolean) ?? [];
  if (item.quarantineProject) return `Quarantine: ${item.quarantineProject.name}`;
  if (attachedAquariums.length > 1) return `shared: ${attachedAquariums.join(", ")}`;
  if (attachedAquariums.length === 1) return item.storageLocation ? `attached to ${attachedAquariums[0]} / storage: ${item.storageLocation.name}` : `attached to ${attachedAquariums[0]}`;
  if (item.aquarium) return item.aquarium.name;
  if (item.storageLocation) return `Storage: ${item.storageLocation.name}`;
  return "Unplaced";
}

function pickerOptionsForProject(candidates: any[], project: any): QuarantinePickerOption[] {
  const projectItemIds = new Set(project.items.map((entry: any) => entry.itemId));
  return candidates
    .filter((item) => !projectItemIds.has(item.id))
    .map((item) => {
      const placement = placementLabel(item);
      const attachedAquariumIds = item.aquariumAttachments?.map((attachment: any) => attachment.aquariumId) ?? [];
      const hostMatch = Boolean(project.aquariumId && (item.aquariumId === project.aquariumId || attachedAquariumIds.includes(project.aquariumId)));
      const type = String(item.itemType);
      const filters = [
        hostMatch ? "host" : null,
        type === "FISH" || type === "INVERT" ? "livestock" : null,
        type === "PLANT" ? "plants" : null,
        type === "EQUIPMENT" || type === "SUBSTRATE" || type === "HARDSCAPE" ? "equipment" : null,
        item.storageLocation ? "storage" : null
      ].filter(Boolean) as string[];
      return {
        id: item.id,
        name: item.name,
        itemType: itemTypeLabel(type),
        quantityLabel: quantityLabel(item),
        placementLabel: placement,
        filters,
        searchText: [item.name, type, item.speciesDefinition?.commonName, item.speciesDefinition?.scientificName, item.speciesVariant?.displayName, item.speciesVariant?.name, placement].filter(Boolean).join(" ").toLowerCase()
      };
    })
    .sort((a, b) => {
      const hostRank = Number(b.filters.includes("host")) - Number(a.filters.includes("host"));
      if (hostRank) return hostRank;
      return a.name.localeCompare(b.name);
    });
}

export default async function QuarantinePage({ searchParams }: { searchParams?: Promise<{ create?: string }> }) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const params = await searchParams;
  const projects = await prisma.quarantineProject.findMany({
    where: { collectionId: collection.id },
    include: {
      aquarium: true,
      items: { include: { item: true }, orderBy: { startedAt: "desc" } }
    },
    orderBy: [{ status: "asc" }, { startedAt: "desc" }]
  });
  const aquariums = await prisma.aquarium.findMany({ where: { collectionId: collection.id, status: { not: "ARCHIVED" } }, orderBy: { name: "asc" } });
  const candidates = await prisma.aquariumItem.findMany({
    where: { collectionId: collection.id, status: { notIn: ["ARCHIVED", "CONSUMED", "DEAD", "REMOVED"] as never[] } },
    include: {
      aquarium: { select: { id: true, name: true } },
      storageLocation: { select: { id: true, name: true } },
      quarantineProject: { select: { id: true, name: true } },
      speciesDefinition: { select: { commonName: true, scientificName: true } },
      speciesVariant: { select: { name: true, displayName: true } },
      aquariumAttachments: { include: { aquarium: { select: { id: true, name: true } } } }
    },
    orderBy: { name: "asc" }
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Quarantine" eyebrow="Observation and isolation" />
      <CreatePanel title="Create quarantine project" defaultOpen={Boolean(params?.create)}>
          <form action={createQuarantineProject} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input name="name" placeholder="Project name" required />
            <Select name="aquariumId" defaultValue=""><option value="">No host aquarium</option>{aquariums.map((aquarium) => <option key={aquarium.id} value={aquarium.id}>{aquarium.name}</option>)}</Select>
            <Input name="reason" placeholder="Reason" />
            <Textarea className="sm:col-span-2 lg:col-span-4" name="notes" placeholder="Notes" />
            <CreateSubmitActions label="Create project" cancelHref="/quarantine" className="sm:col-span-2 lg:col-span-4" />
          </form>
      </CreatePanel>
        <section className="grid gap-4">
          {projects.length ? projects.map((project) => (
            <Card key={project.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-water" /> {project.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{project.reason ?? "Observation project"}</p>
                  </div>
                  <Badge>{project.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{project.aquarium ? `Hosted in ${project.aquarium.name}` : "No host aquarium linked."}</p>
                <div className="grid gap-3">
                  {project.items.map((entry) => (
                    <div key={entry.id} className="grid gap-3 rounded-md bg-muted/45 p-3 md:grid-cols-[1fr_auto_auto] md:items-center">
                      <div>
                        <div className="font-semibold text-primary">{entry.item.name}</div>
                        <div className="text-xs text-muted-foreground">{entry.quantity} {entry.item.unit ?? ""} · {entry.notes ?? "No notes"}</div>
                      </div>
                      <Badge>{entry.status}</Badge>
                      <form action={updateQuarantineItemStatus} className="flex gap-2">
                        <input type="hidden" name="id" value={entry.id} />
                        <input type="hidden" name="status" value="CLEARED" />
                        <Button type="submit" variant="secondary" disabled={entry.status !== "ACTIVE"}>Clear</Button>
                      </form>
                    </div>
                  ))}
                  {!project.items.length ? <div className="rounded-md bg-muted/35 p-4 text-sm text-muted-foreground">No quarantined items yet.</div> : null}
                </div>
                {project.status === "ACTIVE" ? (
                  <div className="space-y-3">
                    {project.aquarium ? (
                      <div className="grid gap-3 rounded-md border border-water/25 bg-water/10 p-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                        <div>
                          <div className="font-semibold text-primary">Add all from {project.aquarium.name}</div>
                          <p className="text-sm text-muted-foreground">Adds eligible livestock and plants currently assigned to this host tank. Existing quarantine entries are skipped.</p>
                        </div>
                        <form action={addHostAquariumItemsToQuarantineProject} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] lg:min-w-[26rem]">
                          <input type="hidden" name="projectId" value={project.id} />
                          <Input name="reason" placeholder="Optional reason" />
                          <Button type="submit" variant="secondary">Add all from {project.aquarium.name}</Button>
                          <label className="flex items-center gap-2 text-xs text-muted-foreground sm:col-span-2">
                            <input type="checkbox" name="includeEquipment" />
                            Include equipment/substrate attached to this host tank
                          </label>
                        </form>
                      </div>
                    ) : null}
                    <QuarantineItemPicker projectId={project.id} options={pickerOptionsForProject(candidates, project)} hostAquariumName={project.aquarium?.name} />
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <form action={updateQuarantineProjectStatus}>
                    <input type="hidden" name="id" value={project.id} />
                    <input type="hidden" name="status" value="COMPLETED" />
                    <Button type="submit" variant="secondary" disabled={project.status !== "ACTIVE"}>Complete</Button>
                  </form>
                  <form action={updateQuarantineProjectStatus}>
                    <input type="hidden" name="id" value={project.id} />
                    <input type="hidden" name="status" value="CANCELLED" />
                    <Button type="submit" variant="secondary" disabled={project.status !== "ACTIVE"}>Cancel</Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          )) : <Card><CardContent className="p-8 text-center text-muted-foreground">Create a quarantine project before moving livestock into observation.</CardContent></Card>}
        </section>
    </div>
  );
}
