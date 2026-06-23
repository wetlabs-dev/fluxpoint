import { prisma } from "@/lib/db/prisma";
import { AquariumCard } from "@/components/aquarium/aquarium-card";
import { AquariumForm } from "@/components/aquarium/aquarium-form";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { buildLocationPath } from "@/lib/format/location";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const salinities = ["FRESHWATER", "BRACKISH", "MARINE"];
const aquariumTypes = ["DISPLAY", "QUARANTINE", "HOSPITAL", "POND", "BREEDING", "GROW_OUT", "FRAG", "HOLDING", "OTHER"];

function salinityFilter(value?: string): Prisma.AquariumWhereInput {
  if (!value || !salinities.includes(value)) return {};
  if (value === "FRESHWATER") return { OR: [{ targetSalinityMinPpt: { lte: 0.5 } }, { targetSalinityMinPpt: null, salinity: "FRESHWATER" }] };
  if (value === "BRACKISH") return { OR: [{ AND: [{ targetSalinityMinPpt: { lte: 30 } }, { targetSalinityMaxPpt: { gte: 0.5 } }] }, { targetSalinityMinPpt: null, salinity: "BRACKISH" }] };
  return { OR: [{ targetSalinityMaxPpt: { gte: 30 } }, { targetSalinityMaxPpt: null, salinity: "MARINE" }] };
}

export default async function AquariumsPage({ searchParams }: { searchParams?: Promise<{ salinity?: string; aquariumType?: string }> }) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const filters = await searchParams;
  const aquariums = await prisma.aquarium.findMany({
    where: { collectionId: collection.id, ...salinityFilter(filters?.salinity), ...(filters?.aquariumType && aquariumTypes.includes(filters.aquariumType) ? { aquariumType: filters.aquariumType as never } : {}) },
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
  const attachableItems = await prisma.aquariumItem.findMany({
    where: { collectionId: collection.id, status: { notIn: ["ARCHIVED", "CONSUMED", "DEAD", "REMOVED"] }, itemType: { in: ["SUBSTRATE", "EQUIPMENT"] } },
    include: { equipmentProfile: true, aquarium: true, storageLocation: true },
    orderBy: { name: "asc" }
  });
  const equipmentItems = attachableItems.map((item) => ({ id: item.id, label: [item.name, item.equipmentProfile?.equipmentType ?? item.itemType.toLowerCase(), item.aquarium?.generatedName ?? item.aquarium?.name ?? item.storageLocation?.name ?? "unassigned"].filter(Boolean).join(" · "), itemType: item.itemType, equipmentType: item.equipmentProfile?.equipmentType ?? null }));
  const locationOptions = locations.map((location) => ({ id: location.id, label: buildLocationPath(location) }));

  return (
    <div className="space-y-5">
      <PageHeader title="Aquariums" eyebrow="Definition and instance records" />
      <Card><CardContent className="p-4"><form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><Select name="salinity" defaultValue={filters?.salinity ?? ""}><option value="">All target habitats</option>{salinities.map((value) => <option key={value} value={value}>{value.charAt(0) + value.slice(1).toLowerCase()}</option>)}</Select><Select name="aquariumType" defaultValue={filters?.aquariumType ?? ""}><option value="">All tank types</option>{aquariumTypes.map((value) => <option key={value}>{value.replace("_", " ")}</option>)}</Select><Button type="submit" variant="secondary">Filter</Button></form></CardContent></Card>
      <Card>
        <CardHeader><CardTitle>Create aquarium</CardTitle></CardHeader>
        <CardContent><AquariumForm locations={locationOptions} equipmentItems={equipmentItems} /></CardContent>
      </Card>
      <section className="grid gap-5 md:grid-cols-2">
          {aquariums.length ? (
            aquariums.map((aquarium) => <AquariumCard key={aquarium.id} aquarium={aquarium} />)
          ) : (
            <Card className="md:col-span-2">
              <CardContent className="p-8 text-center text-muted-foreground">No aquariums yet. Create the first tank to start Fluxpoint.</CardContent>
            </Card>
          )}
      </section>
    </div>
  );
}
