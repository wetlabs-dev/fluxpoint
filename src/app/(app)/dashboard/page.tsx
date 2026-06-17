import { prisma } from "@/lib/db/prisma";
import { AquariumCard } from "@/components/aquarium/aquarium-card";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const aquariums = await prisma.aquarium.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      readings: {
        orderBy: { measuredAt: "desc" },
        take: 3
      },
      items: true
    }
  });

  const activeCount = aquariums.filter((tank) => tank.status === "ACTIVE").length;
  const itemCount = aquariums.reduce((sum, tank) => sum + tank.items.length, 0);

  return (
    <div>
      <PageHeader title="Tank Dashboard" eyebrow="Current waterline">
        <Badge className="bg-card text-primary">{activeCount} active tanks</Badge>
      </PageHeader>
      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Collection rhythm</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">Weekly care, water testing, and equipment maintenance are ready to become workflow-driven.</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{itemCount} tracked items</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">Livestock, plants, hardscape, equipment, food, medication, and additives share one movement model.</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Current Keeper</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">AI naming, care advice, and cover concepts are mocked behind provider-ready service boundaries.</CardContent>
        </Card>
      </section>
      {aquariums.length ? (
        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {aquariums.map((aquarium) => (
            <AquariumCard key={aquarium.id} aquarium={aquarium} />
          ))}
        </section>
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">No aquariums yet. Seed the database or create a tank to start the dashboard.</CardContent>
        </Card>
      )}
    </div>
  );
}
