import { prisma } from "@/lib/db/prisma";
import { AquariumCard } from "@/components/aquarium/aquarium-card";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { differenceInCalendarDays, endOfDay, startOfToday } from "date-fns";
import Link from "next/link";
import { EddyIcon } from "@/components/eddy/EddyIcon";
import { EddyCharacter } from "@/components/eddy/EddyCharacter";

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
  const recentEventCount = await prisma.aquariumEvent.count({
    where: { aquarium: { collectionId: collection.id }, eventDate: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14) } }
  });
  const recentEvents = await prisma.aquariumEvent.findMany({
    where: { aquarium: { collectionId: collection.id } },
    include: { aquarium: true },
    orderBy: { eventDate: "desc" },
    take: 3
  });
  const recentReadings = await prisma.waterParameterReading.findMany({
    where: { aquarium: { collectionId: collection.id }, parameter: { in: ["AMMONIA", "NITRITE", "NITRATE", "PH", "TEMPERATURE"] } },
    include: { aquarium: true },
    orderBy: { measuredAt: "desc" },
    take: 20
  });
  const readingAlerts = recentReadings.filter((reading) => (
    (reading.parameter === "AMMONIA" && reading.value > 0.25) ||
    (reading.parameter === "NITRITE" && reading.value > 0.25) ||
    (reading.parameter === "NITRATE" && reading.value > 40) ||
    (reading.parameter === "PH" && (reading.value < 6 || reading.value > 8.2))
  ));
  const today = startOfToday();
  const dueTasks = await prisma.careTask.findMany({
    where: {
      careSchedule: { collectionId: collection.id },
      status: "PENDING",
      dueAt: { lte: endOfDay(today) }
    },
    include: { aquarium: true, careSchedule: true },
    orderBy: { dueAt: "asc" },
    take: 5
  });
  const overdueCount = dueTasks.filter((task) => task.dueAt < today).length;

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
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{dueTasks.length ? `${dueTasks.length} due today` : `${itemCount} tracked items`}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {dueTasks.length ? dueTasks.slice(0, 3).map((task) => (
              <div key={task.id} className="rounded-md bg-muted/45 p-2">
                <span className="font-semibold text-primary">{task.aquarium?.generatedName ?? task.aquarium?.name ?? "Collection"}</span>: {task.title}
              </div>
            )) : (
              <>
                <p>{dueCount} equipment records need maintenance attention.</p>
                <p>{recentEventCount} timeline events logged in the last 14 days.</p>
              </>
            )}
            {overdueCount ? <Link className="font-semibold text-primary" href="/schedules">{overdueCount} overdue task(s)</Link> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{readingAlerts.length ? `${readingAlerts.length} parameter alerts` : `${activeWorkflows} active workflows`}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {readingAlerts.length ? readingAlerts.slice(0, 3).map((reading) => (
              <div key={reading.id} className="rounded-md bg-muted/45 p-2">
                <span className="font-semibold text-primary">{reading.aquarium.generatedName ?? reading.aquarium.name}</span>: {reading.parameter.toLowerCase()} {reading.value}{reading.unit}
              </div>
            )) : <p>Keeper: {user.name}. Eddy suggestions remain mock-provider backed.</p>}
          </CardContent>
        </Card>
      </section>
      {activeCount === 0 || dueTasks.length ? (
        <Card className="mb-6 border-water/25 bg-water/10">
          <CardContent className="grid items-center gap-4 overflow-hidden p-4 sm:grid-cols-[minmax(0,1fr)_130px]">
            <div><div className="flex items-center gap-2"><EddyIcon size={24} className="h-6 w-6" /><div className="font-semibold text-primary">A note from Eddy</div></div><p className="mt-2 text-sm text-muted-foreground">{activeCount === 0 ? "I can summarize your active tanks once you add one." : overdueCount ? `I noticed ${overdueCount} overdue care task(s). Start there, then ask what needs attention this week.` : `There are ${dueTasks.length} care task(s) due today.`}</p><Link href={activeCount === 0 ? "/aquariums" : "/schedules"} className="mt-3 inline-flex text-sm font-semibold text-primary underline">{activeCount === 0 ? "Add a tank" : "Review tasks"}</Link></div>
            <EddyCharacter side="right" className="mx-auto max-h-40 w-auto" />
          </CardContent>
        </Card>
      ) : null}
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
