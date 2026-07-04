import { ShieldAlert } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { createQuarantineProject, transferItem, updateQuarantineItemStatus, updateQuarantineProjectStatus } from "@/domains/management/actions";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { CreatePanel } from "@/components/forms/CreatePanel";
import { CreateSubmitActions } from "@/components/forms/CreateSubmitActions";

export const dynamic = "force-dynamic";

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
                  <form action={transferItem} className="grid gap-3 rounded-md border border-border bg-background/50 p-3 md:grid-cols-[1fr_100px_1fr_auto]">
                    <input type="hidden" name="destinationType" value="QUARANTINE" />
                    <input type="hidden" name="toQuarantineProjectId" value={project.id} />
                    <Select name="itemId" defaultValue="">
                      <option value="">Add inventory item</option>
                      {candidates.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.quantity} {item.unit ?? ""})</option>)}
                    </Select>
                    <Input name="quantity" type="number" step="0.1" min="0.1" defaultValue="1" />
                    <Input name="reason" placeholder="Reason" />
                    <Button type="submit" variant="secondary">Add</Button>
                  </form>
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
