import { prisma } from "@/lib/db/prisma";
import { AquariumCard } from "@/components/aquarium/aquarium-card";
import { AquariumForm } from "@/components/aquarium/aquarium-form";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { buildLocationPath } from "@/lib/format/location";

export const dynamic = "force-dynamic";

export default async function AquariumsPage() {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const aquariums = await prisma.aquarium.findMany({
    where: { collectionId: collection.id },
    orderBy: { updatedAt: "desc" },
    include: {
      coverMediaAsset: true,
      structuredLocation: { include: { parent: { include: { parent: true } } } },
      readings: {
        orderBy: { measuredAt: "desc" },
        take: 3
      }
    }
  });
  const locations = await prisma.location.findMany({
    where: { collectionId: collection.id },
    include: { parent: { include: { parent: true } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
  });
  const profileItems = await prisma.aquariumItem.findMany({
    where: { collectionId: collection.id, status: "ACTIVE", OR: [{ itemType: "SUBSTRATE" }, { itemType: "EQUIPMENT", equipmentProfile: { is: { equipmentType: { in: ["LIGHT", "HEATER"] } } } }] },
    include: { equipmentProfile: true },
    orderBy: { name: "asc" }
  });
  const substrateItems = profileItems.filter((item) => item.itemType === "SUBSTRATE").map((item) => ({ id: item.id, label: item.name }));
  const lightItems = profileItems.filter((item) => item.equipmentProfile?.equipmentType === "LIGHT").map((item) => ({ id: item.id, label: item.name }));
  const heaterItems = profileItems.filter((item) => item.equipmentProfile?.equipmentType === "HEATER").map((item) => ({ id: item.id, label: [item.equipmentProfile?.brand, item.equipmentProfile?.model].filter(Boolean).join(" ") || item.name }));
  const locationOptions = locations.map((location) => ({ id: location.id, label: buildLocationPath(location) }));

  return (
    <div>
      <PageHeader title="Aquariums" eyebrow="Definition and instance records" />
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <section className="grid gap-5 md:grid-cols-2">
          {aquariums.length ? (
            aquariums.map((aquarium) => <AquariumCard key={aquarium.id} aquarium={aquarium} />)
          ) : (
            <Card className="md:col-span-2">
              <CardContent className="p-8 text-center text-muted-foreground">No aquariums yet. Create the first tank to start Fluxpoint.</CardContent>
            </Card>
          )}
        </section>
        <Card>
          <CardHeader>
            <CardTitle>Create aquarium</CardTitle>
          </CardHeader>
          <CardContent>
            <AquariumForm locations={locationOptions} substrateItems={substrateItems} lightItems={lightItems} heaterItems={heaterItems} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
