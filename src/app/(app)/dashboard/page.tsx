import { prisma } from "@/lib/db/prisma";
import { AquariumCard } from "@/components/aquarium/aquarium-card";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { differenceInCalendarDays } from "date-fns";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const aquariums = await prisma.aquarium.findMany({
    where: { collectionId: collection.id, status: { not: "ARCHIVED" } },
    orderBy: { createdAt: "asc" },
    include: {
      structuredLocation: { include: { parent: { include: { parent: true } } } },
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
  const recentEvents = await prisma.aquariumEvent.findMany({
    where: { aquarium: { collectionId: collection.id } },
    include: { aquarium: true },
    orderBy: { eventDate: "desc" },
    take: 3
  });

  return (
    <div>
      <PageHeader title="Tank Dashboard" eyebrow="Current waterline">
        <Badge className="bg-card text-primary">{activeCount} active tanks</Badge>
      </PageHeader>
      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>{recentEvents.length ? "Recent activity" : "Getting started"}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {recentEvents.length ? recentEvents.map((event) => (
              <div key={event.id} className="rounded-md bg-muted/45 p-2">
                <span className="font-semibold text-primary">{event.aquarium.generatedName ?? event.aquarium.name}</span>: {event.title}
              </div>
            )) : (
              <div className="space-y-3">
                <p>Create a tank, add your first inventory items, and start logging water readings.</p>
                <Link className="inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-soft transition hover:bg-primary/90" href="/aquariums">Create your first aquarium</Link>
              </div>
            )}
          </CardContent>
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
      {activeCount > 0 ? (
        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {aquariums.filter((aquarium) => aquarium.status === "ACTIVE").map((aquarium) => (
            <AquariumCard key={aquarium.id} aquarium={aquarium} />
          ))}
        </section>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center text-muted-foreground">
            <p>No active aquariums yet. Add your first tank to turn Fluxpoint into a living logbook.</p>
            <Link className="inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-soft transition hover:bg-primary/90" href="/aquariums">Create your first aquarium</Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
