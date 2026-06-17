import { prisma } from "@/lib/db/prisma";
import { AquariumCard } from "@/components/aquarium/aquarium-card";
import { AquariumForm } from "@/components/aquarium/aquarium-form";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AquariumsPage() {
  const aquariums = await prisma.aquarium.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      readings: {
        orderBy: { measuredAt: "desc" },
        take: 3
      }
    }
  });

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
            <AquariumForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
