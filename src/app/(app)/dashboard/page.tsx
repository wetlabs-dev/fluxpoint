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
import { activeConditionStatuses } from "@/domains/conditions/condition-catalog";
import { activeWorkflowRunStatuses, openWorkflowStepStatuses } from "@/domains/workflows/workflow-service";
import { aiProviderStatus } from "@/domains/ai/ai-service";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const aquariums = await prisma.aquarium.findMany({
    where: { collectionId: collection.id, status: { not: "ARCHIVED" } },
    orderBy: { createdAt: "asc" },
    include: {
      coverMediaAsset: true,
      structuredLocation: { include: { parent: { include: { parent: true } } } },
      readings: {
        orderBy: { measuredAt: "desc" },
        take: 3
      },
      items: true,
      healthConditions: { where: { status: { in: activeConditionStatuses } }, select: { id: true, severity: true, status: true }, orderBy: { severity: "desc" } }
    }
  });

  const activeCount = aquariums.filter((tank) => tank.status === "ACTIVE").length;
  const seriousConditions = aquariums.flatMap((tank) => tank.healthConditions.filter((condition) => ["HIGH", "CRITICAL"].includes(condition.severity)).map((condition) => ({ ...condition, aquarium: tank })));
  const activeInventoryStatuses = ["ACTIVE", "IN_AQUARIUM", "IN_STORAGE", "IN_QUARANTINE"] as const;
  const inventorySummary = await prisma.aquariumItem.groupBy({
    by: ["itemType"],
    where: { collectionId: collection.id, status: { in: [...activeInventoryStatuses] } },
    _count: { _all: true },
    _sum: { quantity: true }
  });
  const itemCount = inventorySummary.reduce((sum, row) => sum + row._count._all, 0);
  const inventoryCount = (types: string[]) => inventorySummary.filter((row) => types.includes(row.itemType)).reduce((sum, row) => sum + row._count._all, 0);
  const inventoryQuantity = (types: string[]) => inventorySummary.filter((row) => types.includes(row.itemType)).reduce((sum, row) => sum + Number(row._sum.quantity ?? 0), 0);
  const livestockRecords = inventoryCount(["FISH", "INVERT"]);
  const livestockQuantity = inventoryQuantity(["FISH", "INVERT"]);
  const plantRecords = inventoryCount(["PLANT", "BOTANICAL"]);
  const equipmentRecords = inventoryCount(["EQUIPMENT"]);
  const supplyRecords = inventoryCount(["FOOD", "MEDICATION", "ADDITIVE", "SUBSTRATE", "HARDSCAPE"]);
  const equipmentDue = await prisma.aquariumItem.findMany({
    where: { collectionId: collection.id, itemType: "EQUIPMENT", status: { in: [...activeInventoryStatuses] } },
    include: { equipmentProfile: true }
  });
  const dueCount = equipmentDue.filter((item) => {
    const profile = item.equipmentProfile;
    if (!profile?.maintenanceIntervalDays || !profile.lastMaintainedAt) return false;
    return profile.maintenanceIntervalDays - differenceInCalendarDays(new Date(), profile.lastMaintainedAt) <= 0;
  }).length;
  const additionalContentNeedsStructured = await prisma.aquariumAdditionalContent.count({
    where: { collectionId: collection.id, archivedAt: null, intent: "NEEDS_STRUCTURED_RECORD" }
  });
  const activeWorkflows = await prisma.workflowRun.count({
    where: { collectionId: collection.id, status: { in: activeWorkflowRunStatuses() } }
  });
  const availableWorkflowTemplates = await prisma.workflowTemplate.count({
    where: { status: "ACTIVE", OR: [{ collectionId: collection.id }, { collectionId: null }] }
  });
  const dueWorkflowSteps = await prisma.workflowStepRun.count({
    where: { collectionId: collection.id, status: { in: openWorkflowStepStatuses() }, dueAt: { lte: new Date() }, workflowRun: { status: { in: activeWorkflowRunStatuses() } } }
  });
  const scheduledWorkflowAlerts = await prisma.workflowNotification.count({
    where: { collectionId: collection.id, status: "SCHEDULED", workflowRun: { status: { in: activeWorkflowRunStatuses() } } }
  });
  const activeBreedingProjects = await prisma.breedingProject.findMany({
    where: { collectionId: collection.id, status: { in: ["PLANNING", "ACTIVE", "PAUSED"] } },
    include: { speciesDefinition: true, aquarium: true, careTasks: { where: { status: "PENDING" }, orderBy: { dueAt: "asc" }, take: 1 } },
    orderBy: { startedAt: "desc" },
    take: 3
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
  const aiStatus = aiProviderStatus();
  const eddyStatusText = !aiStatus.enabled
    ? "Eddy suggestions are disabled."
    : aiStatus.fallbackActive
      ? `Eddy requested ${aiStatus.requestedProvider}, but is using ${aiStatus.provider}.`
      : aiStatus.provider === "openai"
        ? `Eddy provider: OpenAI${aiStatus.responsesModel ? ` (${aiStatus.responsesModel})` : ""}.`
        : "Eddy provider: Mock mode.";
  const workflowCardLink = readingAlerts.length
    ? { href: "/metrics", label: "Open metrics" }
    : dueWorkflowSteps
      ? { href: "/workflows", label: "Open workflows" }
      : activeBreedingProjects.length
        ? { href: "/breeding", label: "Open breeding projects" }
        : { href: "/workflows", label: "Open workflows" };

  return (
    <div>
      <PageHeader title="Tank Dashboard" eyebrow="Current waterline">
        <Badge className="bg-card text-primary">{activeCount} active tanks</Badge>
      </PageHeader>
      <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader><CardTitle>{recentEvents.length ? "Recent activity" : "Getting started"}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {recentEvents.length ? recentEvents.map((event) => (
              <div key={event.id} className="rounded-md bg-muted/45 p-2">
                <span className="font-semibold text-primary">{event.aquarium.name}</span>: {event.title}
              </div>
            )) : (
              <div className="space-y-3">
                <p>Create a tank, add your first inventory items, and start logging water readings.</p>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{seriousConditions.length ? `${seriousConditions.length} serious condition${seriousConditions.length === 1 ? "" : "s"}` : "Conditions clear"}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">{seriousConditions.length ? seriousConditions.slice(0, 3).map((condition) => <Link key={condition.id} href={`/conditions/${condition.id}`} className="block rounded-md bg-muted/45 p-2"><span className="font-semibold text-primary">{condition.aquarium.name}</span>: {condition.severity.toLowerCase()} · {condition.status.toLowerCase()}</Link>) : <p>No active high or critical conditions are recorded.</p>}<Link className="font-semibold text-primary underline" href="/conditions">Open conditions</Link></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{dueTasks.length ? `${dueTasks.length} due today` : `${itemCount} tracked items`}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {dueTasks.length ? dueTasks.slice(0, 3).map((task) => (
              <div key={task.id} className="rounded-md bg-muted/45 p-2">
                <span className="font-semibold text-primary">{task.aquarium?.name ?? "Collection"}</span>: {task.title}
              </div>
            )) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <DashboardMiniStat label="Livestock" value={`${livestockQuantity || livestockRecords}`} detail={`${livestockRecords} records`} />
                  <DashboardMiniStat label="Plants" value={plantRecords} detail="records" />
                  <DashboardMiniStat label="Equipment" value={equipmentRecords} detail={`${dueCount} due`} />
                  <DashboardMiniStat label="To structure" value={additionalContentNeedsStructured} detail="remembered" />
                </div>
                <p>{supplyRecords} supply records tracked.</p>
                <p>{recentEventCount} timeline events logged in the last 14 days.</p>
              </>
            )}
            <Link className="font-semibold text-primary underline" href={dueTasks.length ? "/schedules" : "/inventory"}>{overdueCount ? `${overdueCount} overdue task(s)` : dueTasks.length ? "Open schedules" : "Open inventory"}</Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{readingAlerts.length ? `${readingAlerts.length} parameter alerts` : dueWorkflowSteps ? `${dueWorkflowSteps} workflow step${dueWorkflowSteps === 1 ? "" : "s"} due` : activeBreedingProjects.length ? `${activeBreedingProjects.length} breeding project${activeBreedingProjects.length === 1 ? "" : "s"}` : `${activeWorkflows} active workflows`}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {readingAlerts.length ? readingAlerts.slice(0, 3).map((reading) => (
              <div key={reading.id} className="rounded-md bg-muted/45 p-2">
                <span className="font-semibold text-primary">{reading.aquarium.name}</span>: {reading.parameter.toLowerCase()} {reading.value}{reading.unit}
              </div>
            )) : dueWorkflowSteps ? <Link href="/workflows" className="block rounded-md bg-muted/45 p-2"><span className="font-semibold text-primary">Workflow attention needed</span><span className="block">Open the workflow queue to complete or skip due steps.</span></Link> : activeBreedingProjects.length ? activeBreedingProjects.map((project) => <Link key={project.id} href={`/breeding/${project.id}`} className="block rounded-md bg-muted/45 p-2"><span className="font-semibold text-primary">{project.title}</span><span className="block">{project.speciesDefinition?.commonName ?? "Mixed / unknown"} · {project.aquarium?.name ?? "No tank"}</span>{project.careTasks[0] ? <span className="block text-xs">Next: {project.careTasks[0].title}</span> : null}</Link>) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <DashboardMiniStat label="Templates" value={availableWorkflowTemplates} detail="ready" />
                  <DashboardMiniStat label="Alerts" value={scheduledWorkflowAlerts} detail="scheduled" />
                </div>
                <p>No workflow steps are due right now.</p>
                <p>{eddyStatusText}</p>
              </>
            )}
            <Link className="font-semibold text-primary underline" href={workflowCardLink.href}>{workflowCardLink.label}</Link>
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

function DashboardMiniStat({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-md bg-muted/45 p-2">
      <div className="text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">{label}</div>
      <div className="font-mono text-lg font-semibold text-primary">{value}</div>
      <div className="text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}
