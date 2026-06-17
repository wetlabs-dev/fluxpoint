import { prisma } from "@/lib/db/prisma";
import { AquariumCard } from "@/components/aquarium/aquarium-card";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { differenceInCalendarDays } from "date-fns";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const aquariums = await prisma.aquarium.findMany({
    where: { collectionId: collection.id, status: { not: "ARCHIVED" } },
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
  const equipmentDue = await prisma.aquariumItem.findMany({
    where: { collectionId: collection.id, itemType: "EQUIPMENT", status: "ACTIVE" },
    include: { equipmentProfile: true }
  });
  const dueCount = equipmentDue.filter((item) => {
    const profile = item.equipmentProfile;
    if (!profile?.maintenanceIntervalDays || !profile.lastMaintainedAt) return false;
    return profile.maintenanceIntervalDays - differenceInCalendarDays(new Date(), profile.lastMaintainedAt) <= 0;
  }).length;
  const activeWorkflows = await prisma.workflowRun.count({
    where: { aquarium: { collectionId: collection.id }, status: "ACTIVE" }
  });

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
          <CardContent className="text-sm text-muted-foreground">{dueCount} equipment records need maintenance attention.</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{activeWorkflows} active workflows</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">Current keeper: {user.name}. AI suggestions remain mock-provider backed.</CardContent>
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
          <CardContent className="p-8 text-center text-muted-foreground">Create your first aquarium.</CardContent>
        </Card>
      )}
    </div>
  );
}
