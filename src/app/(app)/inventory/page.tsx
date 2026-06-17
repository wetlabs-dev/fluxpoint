import { prisma } from "@/lib/db/prisma";
import { archiveItem, createItem, transferItem, updateItem } from "@/domains/management/actions";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";

export const dynamic = "force-dynamic";

const itemTypes = ["FISH", "INVERT", "PLANT", "HARDSCAPE", "EQUIPMENT", "BOTANICAL", "FOOD", "MEDICATION", "ADDITIVE", "OTHER"];
const statuses = ["ACTIVE", "ARCHIVED", "CONSUMED", "DEAD", "REMOVED", "TRANSFERRED"];

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ type?: string; aquariumId?: string; q?: string }> }) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const params = await searchParams;
  const query = params.q?.trim();
  const aquariumId = params.aquariumId === "storage" ? null : params.aquariumId;
  const items = await prisma.aquariumItem.findMany({
    where: {
      collectionId: collection.id,
      ...(params.type && itemTypes.includes(params.type) ? { itemType: params.type as never } : {}),
      ...(params.aquariumId ? { aquariumId } : {}),
      ...(query ? {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { speciesDefinition: { commonName: { contains: query, mode: "insensitive" } } },
          { speciesDefinition: { scientificName: { contains: query, mode: "insensitive" } } }
        ]
      } : {})
    },
    include: { aquarium: true, speciesDefinition: true },
    orderBy: [{ itemType: "asc" }, { name: "asc" }]
  });
  const aquariums = await prisma.aquarium.findMany({ where: { collectionId: collection.id, status: { not: "ARCHIVED" } }, orderBy: { name: "asc" } });
  const species = await prisma.speciesDefinition.findMany({ orderBy: { commonName: "asc" } });

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory" eyebrow="Movable collection items" />
      <Card>
        <CardContent className="p-4">
          <form className="grid gap-3 md:grid-cols-[1fr_160px_180px_auto]">
            <Input name="q" placeholder="Search item or species" defaultValue={query ?? ""} />
            <Select name="type" defaultValue={params.type ?? ""}>
              <option value="">All types</option>
              {itemTypes.map((type) => <option key={type}>{type}</option>)}
            </Select>
            <Select name="aquariumId" defaultValue={params.aquariumId ?? ""}>
              <option value="">All locations</option>
              <option value="storage">Storage/no tank</option>
              {aquariums.map((aquarium) => <option key={aquarium.id} value={aquarium.id}>{aquarium.generatedName ?? aquarium.name}</option>)}
            </Select>
            <Button type="submit" variant="secondary">Filter</Button>
          </form>
        </CardContent>
      </Card>
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <Card>
          <CardContent className="p-0">
            {items.length ? items.map((item) => (
              <div key={item.id} className="grid gap-4 border-b border-border p-4 last:border-b-0">
                <div className="grid gap-3 md:grid-cols-[1fr_150px_180px] md:items-center">
                  <div>
                    <div className="font-semibold text-primary">{item.name}</div>
                    <div className="text-sm text-muted-foreground">{item.speciesDefinition?.scientificName ?? item.description ?? "No definition attached."}</div>
                  </div>
                  <Badge>{item.itemType}</Badge>
                  <div className="text-sm">{item.quantity} {item.unit ?? ""} · {item.aquarium?.generatedName ?? item.aquarium?.name ?? "Storage"}</div>
                </div>
                <div className="grid gap-3 rounded-md bg-muted/45 p-3 md:grid-cols-[1fr_120px_1fr_auto_auto]">
                  <form action={transferItem} className="contents">
                    <input type="hidden" name="itemId" value={item.id} />
                    <Select name="toAquariumId" defaultValue="">
                      <option value="">Storage/no tank</option>
                      {aquariums.map((aquarium) => <option key={aquarium.id} value={aquarium.id}>{aquarium.generatedName ?? aquarium.name}</option>)}
                    </Select>
                    <Input name="quantity" type="number" step="0.1" min="0.1" defaultValue={item.quantity} />
                    <Input name="reason" placeholder="Reason" />
                    <Button type="submit" variant="secondary">Transfer</Button>
                  </form>
                  <form action={archiveItem}>
                    <input type="hidden" name="id" value={item.id} />
                    <Button type="submit" variant="secondary">Archive</Button>
                  </form>
                </div>
                <details className="rounded-md border border-border bg-white/45 p-3">
                  <summary className="cursor-pointer font-semibold text-primary">Edit item</summary>
                  <ItemForm aquariums={aquariums} species={species} item={item} />
                </details>
              </div>
            )) : <div className="p-8 text-center text-muted-foreground">Create your first inventory item.</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Create item</CardTitle></CardHeader>
          <CardContent><ItemForm aquariums={aquariums} species={species} /></CardContent>
        </Card>
      </div>
    </div>
  );
}

function ItemForm({
  aquariums,
  species,
  item
}: {
  aquariums: { id: string; name: string; generatedName: string | null }[];
  species: { id: string; commonName: string }[];
  item?: {
    id: string;
    itemType: string;
    status: string;
    aquariumId: string | null;
    speciesDefinitionId: string | null;
    name: string;
    quantity: number;
    unit: string | null;
    acquiredFrom: string | null;
    acquiredAt: Date | null;
    description: string | null;
    notes: string | null;
  };
}) {
  return (
    <form action={item ? updateItem : createItem} className="mt-3 grid gap-3 md:grid-cols-2">
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      <Select name="itemType" defaultValue={item?.itemType ?? "FISH"}>{itemTypes.map((type) => <option key={type}>{type}</option>)}</Select>
      <Select name="status" defaultValue={item?.status ?? "ACTIVE"}>{statuses.map((status) => <option key={status}>{status}</option>)}</Select>
      <Select name="aquariumId" defaultValue={item?.aquariumId ?? ""}>
        <option value="">Storage/no tank</option>
        {aquariums.map((aquarium) => <option key={aquarium.id} value={aquarium.id}>{aquarium.generatedName ?? aquarium.name}</option>)}
      </Select>
      <Select name="speciesDefinitionId" defaultValue={item?.speciesDefinitionId ?? ""}>
        <option value="">No species definition</option>
        {species.map((definition) => <option key={definition.id} value={definition.id}>{definition.commonName}</option>)}
      </Select>
      <Input name="name" placeholder="Name" defaultValue={item?.name ?? ""} required />
      <Input name="quantity" type="number" step="0.1" placeholder="Quantity" defaultValue={item?.quantity ?? "1"} />
      <Input name="unit" placeholder="Unit" defaultValue={item?.unit ?? ""} />
      <Input name="acquiredFrom" placeholder="Acquired from" defaultValue={item?.acquiredFrom ?? ""} />
      <Input name="acquiredAt" type="date" defaultValue={item?.acquiredAt ? item.acquiredAt.toISOString().slice(0, 10) : ""} />
      <Input name="description" placeholder="Description" defaultValue={item?.description ?? ""} />
      <Textarea className="md:col-span-2" name="notes" placeholder="Notes" defaultValue={item?.notes ?? ""} />
      <Button className="md:col-span-2" type="submit">{item ? "Save item" : "Create item"}</Button>
    </form>
  );
}
