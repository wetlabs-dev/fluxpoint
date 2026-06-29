import { prisma } from "@/lib/db/prisma";
import { archiveItem, createItem, transferItem, updateItem } from "@/domains/management/actions";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { InventoryItemForm } from "@/components/inventory/InventoryItemForm";
import { habitatsForSalinity, speciesMatchesAquariumTarget } from "@/domains/species/habitat";
import { getCollectionRole, isServerAdmin } from "@/domains/auth/permissions";
import { isConcerningRegionalStatus, isRestrictedRegionalStatus, neverReleaseMessage, regionalStatusWarning } from "@/domains/species/regional-status";
import { RegionalStatusBadge } from "@/components/species/RegionalStatusBadge";
import Link from "next/link";
import { CreatePanel } from "@/components/forms/CreatePanel";
import { getQuantityMin, getQuantityStep } from "@/domains/inventory/quantity";

export const dynamic = "force-dynamic";

const itemTypes = ["FISH", "INVERT", "PLANT", "SUBSTRATE", "HARDSCAPE", "EQUIPMENT", "BOTANICAL", "FOOD", "MEDICATION", "ADDITIVE", "OTHER"];
const statuses = ["ACTIVE", "IN_AQUARIUM", "IN_STORAGE", "IN_QUARANTINE", "ARCHIVED", "CONSUMED", "DEAD", "REMOVED", "TRANSFERRED"];

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ type?: string; aquariumId?: string; q?: string; place?: string }> }) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const [collectionRole, serverAdmin] = await Promise.all([getCollectionRole(user.id, collection.id), isServerAdmin(user.id)]);
  const canConfirmRestricted = collectionRole === "COLLECTION_OWNER" || serverAdmin;
  const params = await searchParams;
  const query = params.q?.trim();
  const items = await prisma.aquariumItem.findMany({
    where: {
      collectionId: collection.id,
      ...(params.type && itemTypes.includes(params.type) ? { itemType: params.type as never } : {}),
      ...(params.place === "storage" ? { storageLocationId: { not: null } } : {}),
      ...(params.place === "quarantine" ? { quarantineProjectId: { not: null } } : {}),
      ...(params.place === "aquarium" ? { aquariumId: { not: null } } : {}),
      ...(params.aquariumId ? { aquariumId: params.aquariumId } : {}),
      ...(query ? {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { speciesDefinition: { commonName: { contains: query, mode: "insensitive" } } },
          { speciesDefinition: { scientificName: { contains: query, mode: "insensitive" } } }
        ]
      } : {})
    },
    include: { aquarium: true, speciesDefinition: { include: { regionalStatuses: { where: { collectionId: collection.id } } } }, source: true, storageLocation: true, quarantineProject: true },
    orderBy: [{ itemType: "asc" }, { name: "asc" }]
  });
  const itemConditions = await prisma.healthCondition.findMany({ where: { collectionId: collection.id, entityId: { in: items.map((item) => item.id) }, status: { in: ["WATCHING", "ACTIVE", "TREATING", "IMPROVING", "WORSENING"] } }, select: { id: true, entityId: true, title: true, severity: true } });
  const conditionsByItem = new Map(items.map((item) => [item.id, itemConditions.filter((condition) => condition.entityId === item.id)]));
  const aquariums = await prisma.aquarium.findMany({ where: { collectionId: collection.id, status: { not: "ARCHIVED" } }, orderBy: { name: "asc" } });
  const species = await prisma.speciesDefinition.findMany({
    where: { OR: [{ collectionId: collection.id }, { collectionId: null }] },
    include: { regionalStatuses: { where: { collectionId: collection.id } } },
    orderBy: { commonName: "asc" }
  });
  const sources = await prisma.source.findMany({ where: { collectionId: collection.id }, orderBy: { name: "asc" } });
  const storageLocations = await prisma.location.findMany({ where: { collectionId: collection.id, type: { in: ["BIN", "DRAWER", "REFRIGERATOR", "FREEZER", "CABINET", "SHELF"] } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  const quarantineProjects = await prisma.quarantineProject.findMany({ where: { collectionId: collection.id, status: "ACTIVE" }, orderBy: { startedAt: "desc" } });

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory" eyebrow="Movable collection items" />
      <Card>
        <CardContent className="p-4">
          <form className="grid gap-3 md:grid-cols-[1fr_150px_160px_180px_auto]">
            <Input name="q" placeholder="Search item or species" defaultValue={query ?? ""} />
            <Select name="type" defaultValue={params.type ?? ""}>
              <option value="">All types</option>
              {itemTypes.map((type) => <option key={type}>{type}</option>)}
            </Select>
            <Select name="place" defaultValue={params.place ?? ""}>
              <option value="">All placements</option>
              <option value="aquarium">In aquariums</option>
              <option value="storage">In storage</option>
              <option value="quarantine">In quarantine</option>
            </Select>
            <Select name="aquariumId" defaultValue={params.aquariumId ?? ""}>
              <option value="">All locations</option>
              {aquariums.map((aquarium) => <option key={aquarium.id} value={aquarium.id}>{aquarium.generatedName ?? aquarium.name}</option>)}
            </Select>
            <Button type="submit" variant="secondary">Filter</Button>
          </form>
        </CardContent>
      </Card>
      <CreatePanel title="Create item" defaultOpen={Boolean(params.type || params.aquariumId)}><InventoryItemForm aquariums={aquariums} storageLocations={storageLocations} quarantineProjects={quarantineProjects} species={species} sources={sources} defaultType={params.type} defaultAquariumId={params.aquariumId} canConfirmRestricted={canConfirmRestricted} /></CreatePanel>
        <Card>
          <CardContent className="p-0">
            {items.length ? items.map((item) => (
              <div key={item.id} className="grid gap-4 border-b border-border p-4 last:border-b-0">
                <div className="grid gap-3 md:grid-cols-[1fr_150px_180px] md:items-center">
                  <div>
                    <Link className="font-semibold text-primary underline-offset-4 hover:underline" href={`/inventory/${item.id}`}>{item.name}</Link>
                    <div className="text-sm text-muted-foreground">{item.speciesDefinition?.scientificName ?? item.description ?? "No definition attached."}</div>
                    <div className="text-xs text-muted-foreground">{item.source?.name ?? "No source"}{item.purchasePrice ? ` · $${item.purchasePrice}` : ""}</div>
                    {item.speciesDefinition?.regionalStatuses[0] && isConcerningRegionalStatus(item.speciesDefinition.regionalStatuses[0].status) ? <div className="mt-2 flex flex-wrap items-center gap-2"><RegionalStatusBadge status={item.speciesDefinition.regionalStatuses[0].status} /><span className="text-xs text-muted-foreground">{regionalStatusWarning(item.speciesDefinition.regionalStatuses[0].status, item.speciesDefinition.regionalStatuses[0].localityLabelSnapshot)} {neverReleaseMessage}</span></div> : null}
                    {conditionsByItem.get(item.id)?.length ? <div className="mt-2 text-xs font-semibold text-rose-500">{conditionsByItem.get(item.id)?.length} active condition(s): {conditionsByItem.get(item.id)?.map((condition) => condition.title).join(" · ")}</div> : null}
                  </div>
                  <Badge>{item.itemType}</Badge>
                  <div className="text-sm">{item.quantity} {item.unit ?? ""} · {placementLabel(item)}</div>
                </div>
                <div className="grid gap-3 rounded-md bg-muted/45 p-3 md:grid-cols-[140px_1fr_1fr_120px_1fr_auto_auto]">
                  <form action={transferItem} className="contents">
                    <input type="hidden" name="itemId" value={item.id} />
                    <Select name="destinationType" defaultValue="AQUARIUM">
                      <option value="AQUARIUM">Aquarium</option>
                      <option value="STORAGE">Storage</option>
                      <option value="QUARANTINE">Quarantine</option>
                      <option value="CONSUMED">Consumed</option>
                      <option value="REMOVED">Removed</option>
                      <option value="DEAD">Dead</option>
                    </Select>
                    <Select name="toAquariumId" defaultValue="">
                      <option value="">No aquarium</option>
                      {aquariums.filter((aquarium) => !item.speciesDefinition || speciesMatchesAquariumTarget(aquarium.targetSalinityMinPpt, aquarium.targetSalinityMaxPpt, item.speciesDefinition.salinityMin, item.speciesDefinition.salinityMax)).map((aquarium) => <option key={aquarium.id} value={aquarium.id}>{aquarium.generatedName ?? aquarium.name} · {habitatsForSalinity(aquarium.targetSalinityMinPpt, aquarium.targetSalinityMaxPpt).join(" / ").toLowerCase()}</option>)}
                    </Select>
                    <Select name="toStorageLocationId" defaultValue="">
                      <option value="">No storage bin</option>
                      {storageLocations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                    </Select>
                    <Select name="toQuarantineProjectId" defaultValue="">
                      <option value="">No quarantine</option>
                      {quarantineProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                    </Select>
                    <Input name="quantity" type="number" step={getQuantityStep(item.itemType, item.unit)} min={getQuantityMin(item.itemType)} defaultValue={item.quantity} />
                    <Input name="reason" placeholder="Reason" />
                    <Button type="submit" variant="secondary" disabled={Boolean(item.speciesDefinition?.regionalStatuses[0] && isRestrictedRegionalStatus(item.speciesDefinition.regionalStatuses[0].status) && !canConfirmRestricted)}>Transfer</Button>
                    {item.speciesDefinition?.regionalStatuses[0] && isRestrictedRegionalStatus(item.speciesDefinition.regionalStatuses[0].status) ? <label className="flex items-start gap-2 md:col-span-7"><input type="checkbox" name="regionalStatusConfirmed" disabled={!canConfirmRestricted} /><span className="text-xs font-semibold text-red-700 dark:text-red-200">I confirm I am authorized to handle this {item.speciesDefinition.regionalStatuses[0].status.toLowerCase()} species and have verified current local requirements. {!canConfirmRestricted ? "Collection Owner or Server Admin confirmation is required." : ""}</span></label> : null}
                  </form>
                  <form action={archiveItem}>
                    <input type="hidden" name="id" value={item.id} />
                    <Button type="submit" variant="secondary">Archive</Button>
                  </form>
                </div>
                <details className="rounded-md border border-border bg-background/45 p-3">
                  <summary className="cursor-pointer font-semibold text-primary">Edit item</summary>
                  <InventoryItemForm aquariums={aquariums} storageLocations={storageLocations} quarantineProjects={quarantineProjects} species={species} sources={sources} item={item} canConfirmRestricted={canConfirmRestricted} />
                </details>
                <div className="flex flex-wrap gap-4"><Link className="text-sm font-semibold text-primary underline" href={`/inventory/${item.id}`}>Open detail and history</Link><Link className="text-sm font-semibold text-primary underline" href={`/conditions?aquariumId=${item.aquariumId ?? ""}&entityType=${["FISH", "INVERT", "PLANT"].includes(item.itemType) ? item.itemType : "INVENTORY_ITEM"}&entityId=${item.id}`}>Log or review conditions</Link></div>
              </div>
            )) : <div className="p-8 text-center"><p className="font-semibold text-primary">Your inventory is ready for its first item.</p><p className="mt-1 text-sm text-muted-foreground">Track livestock, plants, equipment, and consumables here, then move them between tanks, storage, and quarantine.</p></div>}
          </CardContent>
        </Card>
    </div>
  );
}

function LegacyItemForm({
  aquariums,
  storageLocations,
  quarantineProjects,
  species,
  sources,
  item,
  defaultType,
  defaultAquariumId
}: {
  aquariums: { id: string; name: string; generatedName: string | null }[];
  storageLocations: { id: string; name: string }[];
  quarantineProjects: { id: string; name: string }[];
  species: { id: string; commonName: string }[];
  sources: { id: string; name: string }[];
  defaultType?: string;
  defaultAquariumId?: string;
  item?: {
    id: string;
    itemType: string;
    status: string;
    aquariumId: string | null;
    storageLocationId: string | null;
    quarantineProjectId: string | null;
    speciesDefinitionId: string | null;
    sourceId: string | null;
    purchasePrice: any;
    name: string;
    quantity: number;
    unit: string | null;
    acquiredAt: Date | null;
    description: string | null;
    notes: string | null;
  };
}) {
  const selectedType = item?.itemType ?? (defaultType && itemTypes.includes(defaultType) ? defaultType : "FISH");
  return (
    <form action={item ? updateItem : createItem} className="mt-3 grid gap-3 md:grid-cols-2">
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      <div className="rounded-md bg-muted/45 p-3 text-xs text-muted-foreground md:col-span-2">
        {typeGuidance(selectedType)}
      </div>
      <Select name="itemType" defaultValue={selectedType}>{itemTypes.map((type) => <option key={type}>{type}</option>)}</Select>
      <Select name="status" defaultValue={item?.status ?? "ACTIVE"}>{statuses.map((status) => <option key={status}>{status}</option>)}</Select>
      <Select name="aquariumId" defaultValue={item?.aquariumId ?? defaultAquariumId ?? ""}>
        <option value="">Storage/no tank</option>
        {aquariums.map((aquarium) => <option key={aquarium.id} value={aquarium.id}>{aquarium.generatedName ?? aquarium.name}</option>)}
      </Select>
      <Select name="storageLocationId" defaultValue={item?.storageLocationId ?? ""}>
        <option value="">No storage location</option>
        {storageLocations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
      </Select>
      <Select name="quarantineProjectId" defaultValue={item?.quarantineProjectId ?? ""}>
        <option value="">No quarantine project</option>
        {quarantineProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
      </Select>
      <Select name="speciesDefinitionId" defaultValue={item?.speciesDefinitionId ?? ""}>
        <option value="">No species definition</option>
        {species.map((definition) => <option key={definition.id} value={definition.id}>{definition.commonName}</option>)}
      </Select>
      <Select name="sourceId" defaultValue={item?.sourceId ?? ""}>
        <option value="">No source/vendor</option>
        {sources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}
      </Select>
      <Input name="name" placeholder="Name" defaultValue={item?.name ?? ""} required />
      <Input name="quantity" type="number" step={getQuantityStep(selectedType, item?.unit)} min={getQuantityMin(selectedType)} placeholder="Quantity" defaultValue={item?.quantity ?? "1"} />
      <label className="space-y-1">
        <span className="text-sm font-medium">Quantity label</span>
        <Input name="unit" placeholder="fish, shrimp, stems, pots, bags, bottles" defaultValue={item?.unit ?? ""} />
        <span className="block text-xs text-muted-foreground">Examples: fish, shrimp, stems, pots, bags, bottles.</span>
      </label>
      <Input name="purchasePrice" type="number" step="0.01" placeholder="Purchase price" defaultValue={item?.purchasePrice ?? ""} />
      <Input name="acquiredAt" type="date" defaultValue={item?.acquiredAt ? item.acquiredAt.toISOString().slice(0, 10) : ""} />
      <Input name="description" placeholder="Description" defaultValue={item?.description ?? ""} />
      <Textarea className="md:col-span-2" name="notes" placeholder="Notes" defaultValue={item?.notes ?? ""} />
      <Button className="md:col-span-2" type="submit">{item ? "Save item" : "Create item"}</Button>
    </form>
  );
}

function placementLabel(item: { aquarium?: { generatedName: string | null; name: string } | null; storageLocation?: { name: string } | null; quarantineProject?: { name: string } | null }) {
  if (item.aquarium) return item.aquarium.generatedName ?? item.aquarium.name;
  if (item.storageLocation) return `Storage: ${item.storageLocation.name}`;
  if (item.quarantineProject) return `Quarantine: ${item.quarantineProject.name}`;
  return "Unassigned";
}

function typeGuidance(type: string) {
  if (["FISH", "INVERT"].includes(type)) return "Livestock: attach a species definition when possible, use quantity as a count, and keep stocking or health notes in the notes field.";
  if (type === "PLANT") return "Plants: attach a plant species definition, use quantity as stems, clumps, or portions, and note placement or propagation details.";
  if (type === "EQUIPMENT") return "Equipment: use the Equipment page for brand/model, warranty, and maintenance interval fields; inventory keeps source, purchase, and movement context.";
  if (type === "SUBSTRATE") return "Substrate: create substrate as inventory so it can be selected from aquarium profiles.";
  if (["FOOD", "MEDICATION", "ADDITIVE"].includes(type)) return "Consumables: use units such as bottle, mL, scoop, tablet, or bag and keep dosing/expiry context in notes.";
  return "Items share one durable model; fill only fields that matter for the thing you are recording.";
}
