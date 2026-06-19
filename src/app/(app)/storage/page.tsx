import { PackageOpen } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { createStorageLocation, deleteStorageLocation, transferItem, updateStorageLocation } from "@/domains/management/actions";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";

export const dynamic = "force-dynamic";

const storageTypes = ["BIN", "DRAWER", "REFRIGERATOR", "FREEZER", "CABINET", "SHELF", "OTHER"];

export default async function StoragePage() {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const locations = await prisma.location.findMany({
    where: { collectionId: collection.id, type: { in: storageTypes as never[] } },
    include: { storedItems: { include: { aquarium: true }, orderBy: { name: "asc" } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
  });
  const aquariums = await prisma.aquarium.findMany({ where: { collectionId: collection.id, status: { not: "ARCHIVED" } }, orderBy: { name: "asc" } });

  return (
    <div className="space-y-6">
      <PageHeader title="Storage" eyebrow="Bins, shelves, and cold storage" />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <section className="grid gap-4">
          {locations.length ? locations.map((location) => (
            <Card key={location.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><PackageOpen className="h-5 w-5 text-water" /> {location.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{location.description ?? "No notes yet."}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2"><Badge>{location.type}</Badge><Badge>{location.storedItems.length} items</Badge></div>
                <div className="grid gap-3">
                  {location.storedItems.map((item) => (
                    <div key={item.id} className="grid gap-3 rounded-md bg-muted/45 p-3 md:grid-cols-[1fr_100px_1fr_auto] md:items-center">
                      <div>
                        <div className="font-semibold text-primary">{item.name}</div>
                        <div className="text-xs text-muted-foreground">{item.quantity} {item.unit ?? ""}</div>
                      </div>
                      <Badge>{item.itemType}</Badge>
                      <form action={transferItem} className="contents">
                        <input type="hidden" name="itemId" value={item.id} />
                        <input type="hidden" name="destinationType" value="AQUARIUM" />
                        <input type="hidden" name="quantity" value={item.quantity} />
                        <Select name="toAquariumId" defaultValue="">
                          <option value="">Choose aquarium</option>
                          {aquariums.map((aquarium) => <option key={aquarium.id} value={aquarium.id}>{aquarium.generatedName ?? aquarium.name}</option>)}
                        </Select>
                        <Button type="submit" variant="secondary">Move to tank</Button>
                      </form>
                    </div>
                  ))}
                  {!location.storedItems.length ? <div className="rounded-md bg-muted/35 p-4 text-sm text-muted-foreground">No items stored here.</div> : null}
                </div>
                <details className="rounded-md border border-border bg-background/50 p-3">
                  <summary className="cursor-pointer font-semibold text-primary">Edit storage location</summary>
                  <StorageLocationForm location={location} />
                  <form action={deleteStorageLocation} className="mt-3">
                    <input type="hidden" name="id" value={location.id} />
                    <Button type="submit" variant="secondary" disabled={location.storedItems.length > 0}>Delete location</Button>
                  </form>
                </details>
              </CardContent>
            </Card>
          )) : <Card><CardContent className="p-8 text-center text-muted-foreground">Create a storage location for foods, meds, tools, or spare equipment.</CardContent></Card>}
        </section>
        <Card>
          <CardHeader><CardTitle>Create storage location</CardTitle></CardHeader>
          <CardContent><StorageLocationForm /></CardContent>
        </Card>
      </div>
    </div>
  );
}

function StorageLocationForm({ location }: { location?: { id: string; name: string; type: string; description: string | null; sortOrder: number } }) {
  return (
    <form action={location ? updateStorageLocation : createStorageLocation} className="mt-3 grid gap-3">
      {location ? <input type="hidden" name="id" value={location.id} /> : null}
      <Input name="name" placeholder="Storage name" defaultValue={location?.name ?? ""} required />
      <Select name="type" defaultValue={location?.type ?? "BIN"}>{storageTypes.map((type) => <option key={type}>{type}</option>)}</Select>
      <Input name="sortOrder" type="number" placeholder="Sort order" defaultValue={location?.sortOrder ?? 0} />
      <Textarea name="description" placeholder="Notes" defaultValue={location?.description ?? ""} />
      <Button type="submit">{location ? "Save location" : "Create location"}</Button>
    </form>
  );
}
