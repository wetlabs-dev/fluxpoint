import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const items = await prisma.aquariumItem.findMany({
    include: { aquarium: true, speciesDefinition: true },
    orderBy: [{ itemType: "asc" }, { name: "asc" }]
  });
  const itemTypes = Array.from(new Set(items.map((item) => item.itemType)));

  return (
    <div>
      <PageHeader title="Inventory" eyebrow="Movable collection items" />
      <div className="mb-4 flex flex-wrap gap-2">
        <Badge>All</Badge>
        {itemTypes.map((type) => <Badge key={type}>{type}</Badge>)}
      </div>
      <Card>
        <CardContent className="p-0">
          {items.length ? items.map((item) => (
            <div key={item.id} className="grid gap-3 border-b border-border p-4 last:border-b-0 md:grid-cols-[1fr_160px_160px_120px] md:items-center">
              <div>
                <div className="font-semibold text-primary">{item.name}</div>
                <div className="text-sm text-muted-foreground">{item.speciesDefinition?.scientificName ?? item.description ?? "Definition can be attached later."}</div>
              </div>
              <Badge>{item.itemType}</Badge>
              <div className="text-sm">{item.aquarium?.generatedName ?? item.aquarium?.name ?? "Storage"}</div>
              <button className="rounded-md border border-border px-3 py-2 text-sm font-semibold text-primary">Transfer</button>
            </div>
          )) : <div className="p-8 text-center text-muted-foreground">No inventory records yet.</div>}
        </CardContent>
      </Card>
    </div>
  );
}
