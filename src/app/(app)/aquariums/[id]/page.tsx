import Link from "next/link";
import { notFound } from "next/navigation";
import { differenceInCalendarDays, format, isBefore, startOfToday } from "date-fns";
import { Droplets, Fish, KeyRound, LineChart, ListPlus, Pill, QrCode, RefreshCw, Utensils, Wrench } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { AquariumForm } from "@/components/aquarium/aquarium-form";
import { archiveAquarium } from "@/domains/aquariums/actions";
import { createAquariumMetricToken, syncAquariumMetricsDashboard, updateAquariumMetricConfig } from "@/domains/metrics/actions";
import { EddyAquariumSummary } from "@/components/eddy/EddyAquariumSummary";
import { aiProviderStatus } from "@/domains/ai/ai-service";
import { getRemainingEddyUsage } from "@/domains/eddy/rate-limits";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { EventCreateForm } from "@/components/aquarium/EventCreateForm";
import { TimelineList } from "@/components/aquarium/TimelineList";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { addInhabitant, assignLightingSchedule, attachEquipmentToAquarium, clearLightingAssignment, completeCareTask, completeWorkflowStep, createMaintenanceEvent, createReadingsBatch, detachEquipmentFromAquarium, generateQrCode, logFeeding, logInhabitantLoss, logMedicationDose, logWaterChange, saveSpeciesHusbandryOverrideAction, saveSpeciesHusbandryOverrideFieldAction, skipCareTask, startWorkflow, transferItem, updateMedicationCourseStatus } from "@/domains/management/actions";
import { formatReading } from "@/lib/format/readings";
import { buildLocationPath } from "@/lib/format/location";
import { ensureAquariumMetricConfigs } from "@/domains/metrics/metrics-service";
import { LightingSchedulePreview } from "@/components/lighting/lighting-schedule-preview";
import { LightingAssignmentForm } from "@/components/lighting/LightingAssignmentForm";
import { calculateScheduleLightLoad, formatLightLoad } from "@/domains/lighting/light-load";
import { valuesForPoint } from "@/domains/lighting/capabilities";
import { getEffectiveHusbandryForItem } from "@/domains/husbandry/husbandry-service";
import { SpeciesHusbandryGuideView } from "@/components/husbandry/SpeciesHusbandryGuideView";
import { SpeciesHusbandryOverrideForm } from "@/components/husbandry/SpeciesHusbandryOverrideForm";
import { MediaUploadButton } from "@/components/media/MediaUploadButton";
import { MediaGallery } from "@/components/media/MediaGallery";
import { MediaThumbnail } from "@/components/media/MediaThumbnail";
import { AquariumPhotoStrip } from "@/components/media/AquariumPhotoStrip";
import { TankMetricChart } from "@/components/aquarium/TankMetricChart";
import { queryAquariumMetricHistory } from "@/domains/metrics/prometheus-query";
import { MedicationStartForm } from "@/components/aquarium/MedicationStartForm";

export const dynamic = "force-dynamic";

const workspaceTabs = [
  ["overview", "Overview"],
  ["inhabitants", "Inhabitants"],
  ["equipment", "Equipment"],
  ["metrics", "Metrics"],
  ["timeline", "Timeline"],
  ["schedules", "Schedules"],
  ["photos", "Photos"],
  ["eddy", "Eddy"],
  ["settings", "Settings"]
] as const;
type WorkspaceTab = typeof workspaceTabs[number][0];

const parameterFields = [
  ["temperature", "Temperature", "F"],
  ["ph", "pH", "pH"],
  ["ammonia", "Ammonia", "ppm"],
  ["nitrite", "Nitrite", "ppm"],
  ["nitrate", "Nitrate", "ppm"],
  ["gh", "GH", "dGH"],
  ["kh", "KH", "dKH"],
  ["tds", "TDS", "ppm"],
  ["turbidity", "Turbidity", "NTU"],
  ["co2", "CO2", "ppm"],
  ["light", "Light", "PAR"],
  ["waterLevel", "Water level", "in"]
] as const;

const maintenanceTypes = ["WATER_CHANGE", "FILTER_SERVICE", "GLASS_CLEANING", "SUBSTRATE_VACUUM", "PLANT_TRIM", "EQUIPMENT_INSPECTION", "DOSING", "LIGHT_ADJUSTMENT", "OTHER"];
const timelineFilterOptions = [
  ["all", "All"], ["WATER_CHANGE", "Water changes"], ["FEEDING", "Feedings"], ["MEDICATION", "Medications"],
  ["livestock", "Livestock"], ["MAINTENANCE", "Maintenance"], ["NOTE", "Notes"]
] as const;

export default async function AquariumDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ metricToken?: string; timelineType?: string; workspace?: string }> }) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const eddyStatus = aiProviderStatus();
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const requestedWorkspace = resolvedSearchParams?.workspace ?? (resolvedSearchParams?.timelineType ? "timeline" : "overview");
  const selectedWorkspace: WorkspaceTab = workspaceTabs.some(([value]) => value === requestedWorkspace) ? requestedWorkspace as WorkspaceTab : "overview";
  const aquarium = await prisma.aquarium.findFirst({
    where: { id, collectionId: collection.id },
    include: {
      profile: true,
      coverMediaAsset: true,
      structuredLocation: { include: { parent: { include: { parent: true } } } },
      lightingAssignments: { include: { schedule: { include: { capabilityProfile: true, points: { orderBy: { sortOrder: "asc" } } } }, equipmentItem: { include: { equipmentProfile: { include: { lightCapabilityProfile: true } } } } } },
      items: {
        include: { equipmentProfile: true, speciesDefinition: { include: { husbandryGuide: true } }, husbandryOverride: true, source: true, mediaAssets: { where: { moderationStatus: "APPROVED", hiddenAt: null }, orderBy: { createdAt: "desc" }, take: 1 } },
        orderBy: { updatedAt: "desc" }
      },
      readings: { orderBy: { measuredAt: "desc" }, take: 80 },
      careTasks: {
        where: { status: "PENDING" },
        include: { careSchedule: true },
        orderBy: { dueAt: "asc" },
        take: 12
      },
      careSchedules: {
        include: { tasks: { orderBy: { dueAt: "desc" }, take: 3 } },
        orderBy: [{ enabled: "desc" }, { nextDueAt: "asc" }]
      },
      events: {
        include: {
          createdBy: true,
          relatedItem: true,
          relatedSpecies: true,
          waterChangeEvent: true,
          feedingEvent: { include: { foodItem: true, targetItem: true } },
          maintenanceEvent: { include: { equipmentItem: { include: { equipmentProfile: true } } } },
          medicationDoseEvent: { include: { medicationCourse: { include: { medicationDefinition: true } } } },
          relatedMedicationCourse: { include: { medicationDefinition: true } },
          readings: true,
          mediaAssets: { where: { moderationStatus: "APPROVED", hiddenAt: null }, orderBy: { createdAt: "desc" }, take: 4 }
        },
        orderBy: { eventDate: "desc" },
        take: 60
      },
      medicationCourses: { include: { medicationDefinition: true, doseEvents: true }, orderBy: { startedAt: "desc" } },
      workflowRuns: {
        include: {
          workflowTemplate: true,
          stepRuns: { include: { workflowStep: true }, orderBy: { workflowStep: { order: "asc" } } }
        },
        orderBy: { startedAt: "desc" }
      },
      aiSuggestions: { orderBy: { createdAt: "desc" }, take: 8 }
    }
  });

  if (!aquarium) notFound();
  const imageUsage = selectedWorkspace === "eddy" ? await getRemainingEddyUsage({ userId: user.id, collectionId: collection.id, featureKey: "COVER_IMAGE_GENERATION" }) : null;
  await ensureAquariumMetricConfigs(aquarium.id);
  const metricConfigs = await prisma.aquariumMetricConfig.findMany({
    where: { aquariumId: aquarium.id, collectionId: collection.id },
    include: {
      metricDefinition: true,
      latestValue: true,
      graphPanels: { include: { dashboard: true } }
    },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }]
  });
  const metricTokens = await prisma.metricIngestionToken.findMany({
    where: { collectionId: collection.id, aquariumId: aquarium.id, revokedAt: null },
    orderBy: { createdAt: "desc" },
    take: 6
  });

  const locations = await prisma.location.findMany({
    where: { collectionId: collection.id },
    include: { parent: { include: { parent: true } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
  });
  const profileItems = await prisma.aquariumItem.findMany({
    where: { collectionId: collection.id, status: "ACTIVE", OR: [{ itemType: "SUBSTRATE" }, { itemType: "EQUIPMENT", equipmentProfile: { is: { equipmentType: { in: ["LIGHT", "HEATER"] } } } }] },
    include: { equipmentProfile: { include: { lightCapabilityProfile: true } } },
    orderBy: { name: "asc" }
  });
  const lightingSchedules = await prisma.lightingSchedule.findMany({
    where: { collectionId: collection.id },
    include: { capabilityProfile: true, points: { orderBy: { sortOrder: "asc" } } },
    orderBy: { name: "asc" }
  });
  const foodItems = await prisma.aquariumItem.findMany({
    where: { collectionId: collection.id, itemType: "FOOD", status: "ACTIVE", OR: [{ aquariumId: aquarium.id }, { aquariumId: null }] },
    orderBy: { name: "asc" }
  });
  const templates = await prisma.workflowTemplate.findMany({ include: { steps: { orderBy: { order: "asc" } } }, orderBy: { name: "asc" } });
  const qrCodes = await prisma.qrCode.findMany({ where: { entityType: "Aquarium", entityId: aquarium.id }, orderBy: { createdAt: "desc" }, take: 4 });
  const speciesDefinitions = await prisma.speciesDefinition.findMany({
    where: { OR: [{ collectionId: collection.id }, { collectionId: null }] },
    orderBy: [{ category: "asc" }, { commonName: "asc" }]
  });
  const sources = await prisma.source.findMany({ where: { collectionId: collection.id }, orderBy: { name: "asc" } });
  const medicationDefinitions = await prisma.medicationDefinition.findMany({ where: { collectionId: collection.id }, orderBy: { name: "asc" } });
  const mediaAssets = await prisma.mediaAsset.findMany({
    where: { collectionId: collection.id, aquariumId: aquarium.id },
    include: { item: { select: { name: true, itemType: true } }, aquariumEvent: { select: { title: true, eventDate: true } } },
    orderBy: { createdAt: "desc" },
    take: 60
  });
  const [otherAquariums, storageLocations, quarantineProjects, availableEquipment] = await Promise.all([
    prisma.aquarium.findMany({ where: { collectionId: collection.id, id: { not: aquarium.id }, status: { not: "ARCHIVED" } }, orderBy: { name: "asc" } }),
    prisma.location.findMany({ where: { collectionId: collection.id }, orderBy: { name: "asc" } }),
    prisma.quarantineProject.findMany({ where: { collectionId: collection.id, status: "ACTIVE" }, orderBy: { name: "asc" } }),
    prisma.aquariumItem.findMany({
      where: { collectionId: collection.id, aquariumId: null, itemType: "EQUIPMENT", status: { in: ["ACTIVE", "IN_STORAGE"] } },
      include: { equipmentProfile: true },
      orderBy: { name: "asc" }
    })
  ]);

  const substrateItems = profileItems.filter((item) => item.itemType === "SUBSTRATE").map((item) => ({ id: item.id, label: item.name }));
  const lightItems = profileItems.filter((item) => item.equipmentProfile?.equipmentType === "LIGHT").map((item) => ({
    id: item.id,
    label: item.name,
    capabilityProfileId: item.equipmentProfile?.lightCapabilityProfileId ?? null,
    capabilityProfileName: item.equipmentProfile?.lightCapabilityProfile?.name ?? null,
    maxLumens: item.equipmentProfile?.maxLumens ?? null
  }));
  const heaterItems = profileItems.filter((item) => item.equipmentProfile?.equipmentType === "HEATER").map((item) => ({ id: item.id, label: [item.equipmentProfile?.brand, item.equipmentProfile?.model].filter(Boolean).join(" ") || item.name }));
  const locationOptions = locations.map((location) => ({ id: location.id, label: buildLocationPath(location) }));
  const livestock = aquarium.items.filter((item) => ["FISH", "INVERT"].includes(item.itemType));
  const plants = aquarium.items.filter((item) => item.itemType === "PLANT");
  const coralOther = aquarium.items.filter((item) => ["BOTANICAL", "OTHER"].includes(item.itemType));
  const husbandryEntries = await Promise.all([...livestock, ...plants, ...coralOther].filter((item) => item.speciesDefinitionId).map(async (item) => [item.id, await getEffectiveHusbandryForItem(item.id)] as const));
  const husbandryByItemId = new Map(husbandryEntries);
  const equipment = aquarium.items.filter((item) => item.itemType === "EQUIPMENT");
  const maintenanceEvents = aquarium.events.filter((event) => event.eventType === "MAINTENANCE" || event.eventType === "WATER_CHANGE");
  const feedingEvents = aquarium.events.filter((event) => event.eventType === "FEEDING");
  const latestByParameter = new Map<string, (typeof aquarium.readings)[number]>();
  for (const reading of aquarium.readings) {
    if (!latestByParameter.has(reading.parameter)) latestByParameter.set(reading.parameter, reading);
  }
  const metricHistories = selectedWorkspace === "metrics" ? await Promise.all(metricConfigs.filter((config) => config.enabled).slice(0, 8).map(async (config) => {
    const prometheusPoints = await queryAquariumMetricHistory({ aquariumId: aquarium.id, prometheusName: config.metricDefinition.prometheusName });
    const historyCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const fallbackPoints = config.metricDefinition.parameter
      ? aquarium.readings.filter((reading) => reading.parameter === config.metricDefinition.parameter && reading.measuredAt.getTime() >= historyCutoff).map((reading) => ({ timestamp: reading.measuredAt.getTime(), value: reading.value })).reverse()
      : [];
    return {
      config,
      points: prometheusPoints?.length ? prometheusPoints : fallbackPoints,
      source: prometheusPoints?.length ? "prometheus" as const : "recent readings" as const
    };
  })) : [];
  const requestedTimelineType = resolvedSearchParams?.timelineType ?? "all";
  const timelineTypes = requestedTimelineType === "livestock" ? ["LIVESTOCK_ADDITION", "LIVESTOCK_LOSS", "PLANT_ADDITION", "PLANT_REMOVAL", "STOCKING", "DEATH"] : [requestedTimelineType];
  const filteredEvents = requestedTimelineType === "all" ? aquarium.events : aquarium.events.filter((event) => timelineTypes.includes(event.eventType));
  const assignment = aquarium.lightingAssignments[0] ?? null;
  const estimatedVolume = aquarium.lengthInches && aquarium.widthInches && aquarium.heightInches
    ? aquarium.lengthInches * aquarium.widthInches * aquarium.heightInches / 231
    : null;
  const tankAgeDays = aquarium.startedAt ? differenceInCalendarDays(new Date(), aquarium.startedAt) : null;
  const selectedSubstrate = substrateItems.find((item) => item.id === aquarium.profile?.substrateItemId)?.label ?? aquarium.profile?.substrate ?? null;
  const selectedLight = lightItems.find((item) => item.id === aquarium.profile?.lightItemId)?.label ?? assignment?.equipmentItem?.name ?? aquarium.profile?.lightingType ?? null;
  const selectedHeater = heaterItems.find((item) => item.id === aquarium.profile?.heaterItemId)?.label ?? aquarium.profile?.heating ?? null;

  return (
    <div className="space-y-6">
      <PageHeader title={aquarium.generatedName ?? aquarium.name} eyebrow={aquarium.name}>
        <div className="flex flex-wrap gap-2">
          <Badge>{aquarium.tankType}</Badge>
          <Badge>{aquarium.status}</Badge>
          <Badge className="font-mono">{aquarium.volumeGallons ?? "?"} {aquarium.volumeUnit === "LITER" ? "liters" : "gallons"}</Badge>
          <form action={archiveAquarium}>
            <input type="hidden" name="id" value={aquarium.id} />
            <Button type="submit" variant="secondary">Archive aquarium</Button>
          </form>
        </div>
      </PageHeader>

      <nav id="workspace" aria-label="Aquarium workspace" role="tablist" className="sticky top-0 z-10 -mx-2 flex gap-2 overflow-x-auto border-y border-border bg-background/90 px-2 py-2 backdrop-blur">
        {workspaceTabs.map(([value, label]) => (
          <Link key={value} href={`/aquariums/${aquarium.id}?workspace=${value}#workspace`} role="tab" aria-selected={selectedWorkspace === value} className={`shrink-0 rounded-md px-3 py-2 text-sm font-semibold transition ${selectedWorkspace === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-primary"}`}>
            {label}
          </Link>
        ))}
      </nav>

      {selectedWorkspace === "overview" ? (
      <section id="overview" className="scroll-mt-20 space-y-5">
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {aquarium.coverMediaAsset?.moderationStatus === "APPROVED" && !aquarium.coverMediaAsset.hiddenAt ? (
            <div className="relative min-h-64">
              <MediaThumbnail asset={aquarium.coverMediaAsset} className="absolute inset-0 h-full w-full rounded-none" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 to-transparent p-6 pt-20 text-white"><div className="font-display text-4xl">{aquarium.generatedName ?? aquarium.name}</div><div className="text-sm text-white/80">{aquarium.coverMediaAsset.caption || "Aquarium workspace"}</div></div>
            </div>
          ) : (
            <div className="waterline grid min-h-48 place-items-center p-6 text-center text-white"><div><div className="font-display text-4xl">{aquarium.generatedName ?? aquarium.name}</div><p className="mt-2 text-sm text-white/80">Add an approved photo to make it the aquarium cover.</p></div></div>
          )}
        </div>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <Card>
            <CardHeader><CardTitle>Overview</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Info label="Location" value={aquarium.structuredLocation ? buildLocationPath(aquarium.structuredLocation) : aquarium.location} />
              <Info label="Started" value={aquarium.startedAt ? format(aquarium.startedAt, "MMM d, yyyy") : null} />
              <Info label="Tank age" value={tankAgeDays !== null ? `${tankAgeDays} days` : null} />
              <Info label="Dimensions" value={[aquarium.lengthInches, aquarium.widthInches, aquarium.heightInches].filter(Boolean).join(" x ") || null} />
              <Info label="Estimated volume" value={estimatedVolume ? `${estimatedVolume.toFixed(1)} gal` : null} />
              <Info label="Substrate" value={selectedSubstrate} />
              <Info label="Light" value={selectedLight} />
              <Info label="Heater" value={selectedHeater} />
              <Info label="Lighting schedule" value={assignment?.schedule?.name ?? aquarium.profile?.lightingSchedule} />
              <Info label="Filtration" value={aquarium.profile?.filtration} />
              <Info label="Water source" value={aquarium.profile?.waterSource} />
              <Info label="Target water" value={[aquarium.profile?.targetTemperature ? `${aquarium.profile.targetTemperature}F` : null, aquarium.profile?.targetPh ? `pH ${aquarium.profile.targetPh}` : null, aquarium.profile?.targetGh ? `GH ${aquarium.profile.targetGh}` : null, aquarium.profile?.targetKh ? `KH ${aquarium.profile.targetKh}` : null].filter(Boolean).join(" · ") || null} />
              <div className="md:col-span-2 xl:col-span-3 text-sm text-muted-foreground">{aquarium.description ?? "No description yet."}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
            <CardContent className="grid gap-2">
              <QuickAction href={`/inventory?type=FISH&aquariumId=${aquarium.id}`} label="Add livestock" />
              <QuickAction href={`/inventory?type=PLANT&aquariumId=${aquarium.id}`} label="Add plant" />
              <QuickAction href="/equipment" label="Add equipment" />
              <QuickAction href={`/aquariums/${aquarium.id}?workspace=timeline#event-form`} label="Log event" />
              <QuickAction href={`/aquariums/${aquarium.id}?workspace=metrics#water-change-form`} label="Log water change" />
              <QuickAction href={`/aquariums/${aquarium.id}?workspace=schedules#feeding-form`} label="Log feeding" />
              <QuickAction href={`/aquariums/${aquarium.id}?workspace=metrics#parameter-form`} label="Log parameter" />
              <QuickAction href={`/aquariums/${aquarium.id}?workspace=photos#photo-upload`} label="Upload photo" />
              <QuickAction href={`/aquariums/${aquarium.id}?workspace=equipment#maintenance-form`} label="Add maintenance" />
              <QuickAction href={`/aquariums/${aquarium.id}?workspace=schedules#medication-form`} label="Start medication" />
              <QuickAction href={`/aquariums/${aquarium.id}?workspace=settings#qr-labels`} label="Generate QR" />
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryStat label="Inhabitants" value={`${[...livestock, ...plants, ...coralOther].reduce((sum, item) => sum + item.quantity, 0)} total`} detail={`${livestock.length + plants.length + coralOther.length} records`} />
          <SummaryStat label="Equipment" value={equipment.length} detail={equipment.some((item) => equipmentDue(item.equipmentProfile)) ? "Maintenance due" : "No overdue service"} />
          <SummaryStat label="Schedules" value={aquarium.careSchedules.filter((schedule) => schedule.enabled).length} detail={`${aquarium.careTasks.length} upcoming tasks`} />
          <SummaryStat label="Activity" value={aquarium.events.length ? format(aquarium.events[0].eventDate, "MMM d") : "None"} detail={aquarium.events[0]?.title ?? "No events yet"} />
          <SummaryStat label="Medication" value={aquarium.medicationCourses.filter((course) => course.status === "ACTIVE").length ? "Active" : "None"} detail={aquarium.medicationCourses.find((course) => course.status === "ACTIVE")?.medicationDefinition.name ?? "No active course"} />
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Current waterline</CardTitle></CardHeader>
            <CardContent><LatestReadings readings={[...latestByParameter.values()].slice(0, 6)} metricConfigs={metricConfigs} /></CardContent>
          </Card>
          <Card>
            <CardHeader><div className="flex items-center justify-between gap-3"><CardTitle>Recent activity</CardTitle><Link href={`/aquariums/${aquarium.id}?workspace=timeline#workspace`} className="text-sm font-semibold text-primary hover:underline">View timeline</Link></div></CardHeader>
            <CardContent><TimelineList events={aquarium.events.slice(0, 4)} /></CardContent>
          </Card>
        </div>
        <Card><CardHeader><CardTitle>Latest photos</CardTitle></CardHeader><CardContent><AquariumPhotoStrip assets={mediaAssets} /></CardContent></Card>
      </section>
      ) : null}

      {selectedWorkspace === "inhabitants" ? (
      <section id="inhabitants" className="scroll-mt-20 space-y-5">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Card>
            <CardHeader><CardTitle>Inhabitants</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <InhabitantGroup aquariumId={aquarium.id} title="Fish" items={livestock.filter((item) => item.itemType === "FISH")} husbandryByItemId={husbandryByItemId} />
              <InhabitantGroup aquariumId={aquarium.id} title="Invertebrates" items={livestock.filter((item) => item.itemType === "INVERT")} husbandryByItemId={husbandryByItemId} />
              <InhabitantGroup aquariumId={aquarium.id} title="Plants" items={plants} husbandryByItemId={husbandryByItemId} plantLanguage />
              <InhabitantGroup aquariumId={aquarium.id} title="Coral / Other" items={coralOther} husbandryByItemId={husbandryByItemId} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Fish className="h-5 w-5 text-water" /> Add Inhabitant</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <AddInhabitantForm aquariumId={aquarium.id} speciesDefinitions={speciesDefinitions} sources={sources} />
              <div>
                <h3 className="mb-2 text-sm font-semibold text-primary">Log loss or removal</h3>
                <InhabitantLossForm aquariumId={aquarium.id} items={[...livestock, ...plants]} />
              </div>
              <div className="border-t border-border pt-5">
                <h3 className="mb-2 text-sm font-semibold text-primary">Move an inhabitant</h3>
                <InhabitantTransferForm
                  items={[...livestock, ...plants, ...coralOther]}
                  aquariums={otherAquariums}
                  storageLocations={storageLocations}
                  quarantineProjects={quarantineProjects}
                />
              </div>
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader><div className="flex items-center justify-between gap-3"><CardTitle>Recent livestock activity</CardTitle><Link href={`/aquariums/${aquarium.id}?workspace=timeline&timelineType=livestock#workspace`} className="text-sm font-semibold text-primary hover:underline">View all</Link></div></CardHeader>
          <CardContent><TimelineList events={aquarium.events.filter((event) => ["LIVESTOCK_ADDITION", "LIVESTOCK_LOSS", "PLANT_ADDITION", "PLANT_REMOVAL", "STOCKING", "DEATH", "TRANSFER"].includes(event.eventType)).slice(0, 6)} emptyText="No livestock movement or loss events yet." /></CardContent>
        </Card>
      </section>
      ) : null}

      {selectedWorkspace === "equipment" ? (
      <section id="equipment" className="scroll-mt-20 grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader><CardTitle>Equipment</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <ItemList aquariumId={aquarium.id} items={equipment} emptyText="No equipment assigned." showEquipment />
            <form action={attachEquipmentToAquarium} className="grid gap-3 border-t border-border pt-4 sm:grid-cols-[minmax(0,1fr)_auto]">
              <input type="hidden" name="aquariumId" value={aquarium.id} />
              <Select name="itemId" required defaultValue="">
                <option value="">Attach existing equipment</option>
                {availableEquipment.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.equipmentProfile?.equipmentType ?? "equipment"}</option>)}
              </Select>
              <Button type="submit" disabled={!availableEquipment.length}>Attach</Button>
            </form>
            {!availableEquipment.length ? <p className="text-xs text-muted-foreground">No unassigned equipment is available. Create equipment from the Equipment page first.</p> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Lighting assignment</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <AquariumLightLoadSummary assignments={aquarium.lightingAssignments} />
            {aquarium.lightingAssignments.length ? (
              <div className="grid gap-3">
                {aquarium.lightingAssignments.map((lightingAssignment) => (
                  <div key={lightingAssignment.id} className="rounded-md border border-border bg-muted/35 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-primary">{lightingAssignment.equipmentItem?.name ?? "Unlinked light"}</div>
                        <div className="text-xs text-muted-foreground">{lightingAssignment.equipmentItem?.equipmentProfile?.lightCapabilityProfile?.name ?? "No capability profile"}</div>
                      </div>
                      <form action={clearLightingAssignment}>
                        <input type="hidden" name="id" value={lightingAssignment.id} />
                        <Button type="submit" variant="secondary">Remove</Button>
                      </form>
                    </div>
                    {lightingAssignment.schedule ? <ScheduleSummary schedule={lightingAssignment.schedule} /> : <p className="mt-2 text-sm text-muted-foreground">No schedule selected.</p>}
                  </div>
                ))}
              </div>
            ) : <p className="rounded-md bg-muted/35 p-3 text-sm text-muted-foreground">No light fixtures have schedules yet.</p>}
            <LightingAssignmentForm aquariumId={aquarium.id} lights={lightItems} schedules={lightingSchedules} assignments={aquarium.lightingAssignments} />
            <p className="text-xs text-muted-foreground">Fluxpoint validates fixture compatibility when you save, so RGBW lights only receive RGBW schedules.</p>
          </CardContent>
        </Card>
        <Card id="maintenance-form" className="xl:col-span-2">
          <CardHeader><CardTitle>Log equipment or tank maintenance</CardTitle></CardHeader>
          <CardContent><MaintenanceForm aquariumId={aquarium.id} equipmentItems={equipment} /></CardContent>
        </Card>
      </section>
      ) : null}

      {selectedWorkspace === "metrics" ? (<>
      <section id="metrics" className="scroll-mt-20 space-y-5">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><LineChart className="h-5 w-5 text-water" /> Metrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
                <div id="parameter-form" className="scroll-mt-24">
                  <h3 className="mb-3 text-sm font-semibold text-primary">Log test batch</h3>
                  <ParameterBatchForm aquariumId={aquarium.id} />
                </div>
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-primary">Latest water readings</h3>
                  <LatestReadings readings={[...latestByParameter.values()]} />
                </div>
              </div>
              {resolvedSearchParams?.metricToken ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100">
                  <div className="font-semibold">Copy this token now. Fluxpoint stores only its hash.</div>
                  <code className="mt-2 block break-all rounded-md bg-background/80 p-3 font-mono text-xs">{resolvedSearchParams.metricToken}</code>
                </div>
              ) : null}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    <tr><th className="py-2">Metric</th><th>Latest</th><th>Bounds</th><th>Prometheus</th><th>Configure</th></tr>
                  </thead>
                  <tbody>
                    {metricConfigs.map((config) => (
                      <tr key={config.id} className="border-t border-border align-top">
                        <td className="py-3">
                          <div className="font-semibold text-primary">{config.metricDefinition.displayName}</div>
                          <div className="text-xs text-muted-foreground">{config.metricDefinition.description}</div>
                          <Badge className="mt-2">{config.enabled ? "enabled" : "disabled"}</Badge>
                        </td>
                        <td className="py-3 font-mono">
                          {config.latestValue ? (
                            <>
                              <div className="text-base font-semibold">{config.latestValue.value} {config.latestValue.unit}</div>
                              <div className="text-xs text-muted-foreground">{format(config.latestValue.measuredAt, "MMM d h:mm a")}</div>
                            </>
                          ) : <span className="text-muted-foreground">No data</span>}
                        </td>
                        <td className="py-3 font-mono text-xs text-muted-foreground">
                          {config.minValue ?? config.metricDefinition.defaultMin ?? "no min"} / {config.maxValue ?? config.metricDefinition.defaultMax ?? "no max"}
                        </td>
                        <td className="py-3">
                          <code className="rounded bg-muted px-2 py-1 text-xs">{config.metricDefinition.prometheusName}</code>
                        </td>
                        <td className="py-3">
                          <form action={updateAquariumMetricConfig} className="grid gap-2 sm:grid-cols-[auto_90px_90px_auto]">
                            <input type="hidden" name="id" value={config.id} />
                            <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                              <input type="checkbox" name="enabled" defaultChecked={config.enabled} />
                              Enabled
                            </label>
                            <Input name="minValue" type="number" step="0.01" placeholder="Min" defaultValue={config.minValue ?? ""} />
                            <Input name="maxValue" type="number" step="0.01" placeholder="Max" defaultValue={config.maxValue ?? ""} />
                            <Button type="submit" variant="secondary">Save</Button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Sensor Access</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <form action={createAquariumMetricToken} className="grid gap-3">
                <input type="hidden" name="aquariumId" value={aquarium.id} />
                <Input name="name" placeholder="Token label, e.g. Living room Pi" />
                <Button type="submit"><KeyRound className="mr-2 h-4 w-4" />Create ingest token</Button>
              </form>
              <div className="space-y-2">
                {metricTokens.map((token) => (
                  <div key={token.id} className="rounded-md border border-border bg-background/55 p-3">
                    <div className="font-semibold text-primary">{token.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      created {format(token.createdAt, "MMM d")} · last used {token.lastUsedAt ? format(token.lastUsedAt, "MMM d h:mm a") : "never"}
                    </div>
                  </div>
                ))}
                {!metricTokens.length ? <p className="text-sm text-muted-foreground">No active sensor tokens for this aquarium.</p> : null}
              </div>
              <form action={syncAquariumMetricsDashboard}>
                <input type="hidden" name="aquariumId" value={aquarium.id} />
                <Button type="submit" variant="secondary" className="w-full"><RefreshCw className="mr-2 h-4 w-4" />Sync dashboard</Button>
              </form>
              <p className="text-xs text-muted-foreground">Devices post readings to <code>/api/metrics/ingest</code>. Prometheus scrapes <code>/api/metrics/prometheus</code>.</p>
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader><CardTitle>Seven-day metric history</CardTitle></CardHeader>
          <CardContent className="grid gap-4 xl:grid-cols-2">
            {metricHistories.map(({ config, points, source }) => (
              <TankMetricChart
                key={config.id}
                label={config.metricDefinition.displayName}
                unit={config.metricDefinition.unit}
                points={points}
                minValue={config.minValue ?? config.metricDefinition.defaultMin}
                maxValue={config.maxValue ?? config.metricDefinition.defaultMax}
                source={source}
              />
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="scroll-mt-20 grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <Card>
          <CardHeader><CardTitle id="water-change-form">Log water change</CardTitle></CardHeader>
          <CardContent><WaterChangeForm aquariumId={aquarium.id} /></CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader><CardTitle>Recent readings</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <LatestReadings readings={[...latestByParameter.values()]} />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  <tr><th className="py-2">Parameter</th><th>Value</th><th>Measured</th><th>Notes</th></tr>
                </thead>
                <tbody>
                  {aquarium.readings.slice(0, 24).map((reading) => (
                    <tr key={reading.id} className="border-t border-border">
                      <td className="py-2 font-semibold">{reading.parameter}</td>
                      <td className="font-mono">{formatReading(reading.parameter, reading.value, reading.unit)}</td>
                      <td className="font-mono text-xs text-muted-foreground">{format(reading.measuredAt, "MMM d h:mm a")}</td>
                      <td className="text-muted-foreground">{reading.notes ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rounded-md border border-border bg-muted/35 p-4 text-sm text-muted-foreground">Prometheus remains the primary history source. Recent operational readings are used only when the local Prometheus service is unavailable or has not collected a series yet.</div>
          </CardContent>
        </Card>
      </section>
      </>) : null}

      {selectedWorkspace === "timeline" ? (
      <section id="timeline" className="scroll-mt-20 grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <Card id="event-form" className="scroll-mt-24">
          <CardHeader><CardTitle>Add timeline event</CardTitle></CardHeader>
          <CardContent><EventCreateForm aquariumId={aquarium.id} items={aquarium.items} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {timelineFilterOptions.map(([type, label]) => (
                <Link key={type} href={type === "all" ? `/aquariums/${aquarium.id}?workspace=timeline#workspace` : `/aquariums/${aquarium.id}?workspace=timeline&timelineType=${type}#workspace`} scroll className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition ${requestedTimelineType === type ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-muted"}`}>
                  {label}
                </Link>
              ))}
            </div>
            <TimelineList events={filteredEvents} emptyText={`No ${requestedTimelineType === "all" ? "timeline" : requestedTimelineType.replaceAll("_", " ").toLowerCase()} events yet.`} />
          </CardContent>
        </Card>
      </section>
      ) : null}

      {selectedWorkspace === "schedules" ? (<>
      <section id="schedules" className="scroll-mt-20 grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <Card>
          <CardHeader><CardTitle id="feeding-form">Log feeding</CardTitle></CardHeader>
          <CardContent><FeedingForm aquariumId={aquarium.id} foodItems={foodItems} inhabitants={[...livestock, ...plants, ...coralOther]} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Care schedules</CardTitle></CardHeader>
          <CardContent><CareScheduleList schedules={aquarium.careSchedules} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Upcoming care</CardTitle></CardHeader>
          <CardContent><CareTaskList tasks={aquarium.careTasks} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Lighting schedules</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <AquariumLightLoadSummary assignments={aquarium.lightingAssignments} />
            {aquarium.lightingAssignments.map((lightingAssignment) => (
              <div key={lightingAssignment.id} className="rounded-md border border-border bg-background/55 p-3">
                <div className="font-semibold text-primary">{lightingAssignment.equipmentItem?.name ?? "Light fixture"}</div>
                {lightingAssignment.schedule ? <ScheduleSummary schedule={lightingAssignment.schedule} /> : <p className="mt-1 text-sm text-muted-foreground">No schedule assigned.</p>}
              </div>
            ))}
            {!aquarium.lightingAssignments.length ? <p className="text-sm text-muted-foreground">No lighting schedules are attached to this aquarium.</p> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle id="medication-form" className="flex items-center gap-2"><Pill className="h-5 w-5 text-water" /> Start medication course</CardTitle></CardHeader>
          <CardContent><MedicationStartForm aquariumId={aquarium.id} initialVolumeGallons={aquarium.volumeGallons} initialVolumeUnit={aquarium.volumeUnit} definitions={medicationDefinitions} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Active medications</CardTitle></CardHeader>
          <CardContent><MedicationCourseList courses={aquarium.medicationCourses} /></CardContent>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle>Care history</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-primary">Maintenance</h3>
              <TimelineList events={maintenanceEvents} emptyText="No maintenance logged yet." />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-primary">Feeding</h3>
              <TimelineList events={feedingEvents} emptyText="No feeding logged yet." />
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Workflows</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <form action={startWorkflow} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
              <input type="hidden" name="aquariumId" value={aquarium.id} />
              <Select name="workflowTemplateId">{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</Select>
              <Button type="submit">Start</Button>
            </form>
            {aquarium.workflowRuns.length ? aquarium.workflowRuns.map((run) => (
              <div key={run.id} className="rounded-md border border-border bg-background/45 p-3">
                <div className="font-semibold">{run.workflowTemplate.name}</div>
                <div className="font-mono text-sm text-muted-foreground">{run.status}</div>
                <div className="mt-3 space-y-2">
                  {run.stepRuns.map((step) => (
                    <form key={step.id} action={completeWorkflowStep} className="flex items-center justify-between gap-3 rounded-md bg-muted/45 p-2">
                      <input type="hidden" name="id" value={step.id} />
                      <span className="text-sm">{step.workflowStep.title}</span>
                      <Button type="submit" variant="secondary" disabled={step.status === "COMPLETED"}>{step.status === "COMPLETED" ? "Done" : "Complete"}</Button>
                    </form>
                  ))}
                </div>
              </div>
            )) : <p className="text-sm text-muted-foreground">No active workflows for this tank.</p>}
          </CardContent>
        </Card>
      </section>
      </>) : null}

      {selectedWorkspace === "photos" ? (
      <section id="photos" className="scroll-mt-20 space-y-5">
        <Card>
          <CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle>Photos</CardTitle><p className="mt-1 text-sm text-muted-foreground">Aquarium, timeline, inhabitant, and equipment photos in one moderated gallery.</p></div><span id="photo-upload" className="scroll-mt-24"><MediaUploadButton aquariumId={aquarium.id} items={aquarium.items.map((item) => ({ id: item.id, label: `${item.name} · ${item.itemType.toLowerCase()}` }))} events={aquarium.events.map((event) => ({ id: event.id, label: `${format(event.eventDate, "MMM d")} · ${event.title}` }))} /></span></div></CardHeader>
          <CardContent><MediaGallery assets={mediaAssets} coverMediaAssetId={aquarium.coverMediaAssetId} /></CardContent>
        </Card>
      </section>
      ) : null}

      {selectedWorkspace === "eddy" ? (
      <section id="eddy-studio" className="scroll-mt-20">
        <EddyAquariumSummary aquariumId={aquarium.id} provider={eddyStatus.provider} fallbackActive={eddyStatus.fallbackActive} imageEnabled={eddyStatus.imageEnabled} initialImageUsage={imageUsage} />
      </section>
      ) : null}

      {selectedWorkspace === "settings" ? (
        <section className="grid gap-5 xl:grid-cols-2">
          <Card id="qr-labels" className="scroll-mt-20">
            <CardHeader><CardTitle>QR / Labels</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <form action={generateQrCode}>
                <input type="hidden" name="entityType" value="Aquarium" />
                <input type="hidden" name="entityId" value={aquarium.id} />
                <input type="hidden" name="label" value={aquarium.generatedName ?? aquarium.name} />
                <Button type="submit"><QrCode className="mr-2 h-4 w-4" />Generate tank QR payload</Button>
              </form>
              {qrCodes.map((qr) => <div key={qr.id} className="rounded-md bg-muted/55 p-3"><div className="font-semibold">{qr.label}</div><code className="block break-all font-mono text-xs text-muted-foreground">{qr.payload}</code></div>)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Edit tank profile</CardTitle></CardHeader>
            <CardContent><AquariumForm aquarium={aquarium} locations={locationOptions} substrateItems={substrateItems} lightItems={lightItems} heaterItems={heaterItems} /></CardContent>
          </Card>
        </section>
      ) : null}
    </div>
  );
}

function QuickAction({ href, label }: { href: string; label: string }) {
  return <Link className="inline-flex min-h-10 items-center justify-between rounded-md border border-border bg-background/60 px-3 py-2 text-sm font-semibold text-primary transition hover:bg-muted" href={href}>{label}<ListPlus className="h-4 w-4" /></Link>;
}

function Info({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="rounded-md bg-muted/55 p-3">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="font-semibold">{value || "Not set"}</div>
    </div>
  );
}

function SummaryStat({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return <div className="rounded-lg border border-border bg-card p-4"><div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div><div className="mt-1 font-mono text-xl font-semibold text-primary">{value}</div><div className="mt-1 truncate text-xs text-muted-foreground">{detail}</div></div>;
}

function LatestReadings({ readings, metricConfigs = [] }: { readings: { id: string; parameter: string; value: number; unit: string; measuredAt: Date }[]; metricConfigs?: { minValue: number | null; maxValue: number | null; metricDefinition: { parameter: string | null; defaultMin: number | null; defaultMax: number | null } }[] }) {
  if (!readings.length) return <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">No readings yet.</div>;
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {readings.map((reading) => {
        const config = metricConfigs.find((entry) => entry.metricDefinition.parameter === reading.parameter);
        const min = config?.minValue ?? config?.metricDefinition.defaultMin ?? null;
        const max = config?.maxValue ?? config?.metricDefinition.defaultMax ?? null;
        const state = min !== null && reading.value < min ? "low" : max !== null && reading.value > max ? "high" : min !== null || max !== null ? "in range" : null;
        return <div key={reading.id} className="rounded-md bg-muted/55 p-3">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{reading.parameter}</div>
          <div className="font-mono text-xl font-semibold text-primary">{formatReading(reading.parameter, reading.value, reading.unit)}</div>
          <div className="font-mono text-xs text-muted-foreground">{format(reading.measuredAt, "MMM d h:mm a")}</div>
          {state ? <div className={`mt-1 text-xs font-semibold ${state === "in range" ? "text-emerald-600 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}`}>{state}</div> : null}
        </div>
      })}
    </div>
  );
}

function equipmentDue(profile: { maintenanceIntervalDays?: number | null; lastMaintainedAt?: Date | null } | null) {
  if (!profile?.maintenanceIntervalDays) return false;
  if (!profile.lastMaintainedAt) return true;
  return Date.now() >= profile.lastMaintainedAt.getTime() + profile.maintenanceIntervalDays * 24 * 60 * 60 * 1000;
}

function equipmentNextDue(profile: { maintenanceIntervalDays?: number | null; lastMaintainedAt?: Date | null } | null) {
  if (!profile?.maintenanceIntervalDays || !profile.lastMaintainedAt) return null;
  return new Date(profile.lastMaintainedAt.getTime() + profile.maintenanceIntervalDays * 24 * 60 * 60 * 1000);
}

function ItemList({ aquariumId, items, emptyText, showEquipment = false }: { aquariumId: string; items: any[]; emptyText: string; showEquipment?: boolean }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="grid gap-3 rounded-md border border-border bg-background/45 p-3 sm:grid-cols-[72px_minmax(0,1fr)_auto]">
          {item.mediaAssets?.[0] ? <MediaThumbnail asset={item.mediaAssets[0]} className="aspect-square w-[72px]" /> : <div className="grid aspect-square w-[72px] place-items-center rounded-md bg-muted text-xs text-muted-foreground">No photo</div>}
          <div>
            <div className="font-semibold text-primary">{item.name}</div>
            <div className="text-sm text-muted-foreground">
              {item.speciesDefinition?.commonName ?? item.description ?? item.equipmentProfile?.equipmentType ?? item.itemType.toLowerCase()}
            </div>
            {showEquipment ? <div className="font-mono text-xs text-muted-foreground">{item.equipmentProfile?.brand ?? "Unbranded"} {item.equipmentProfile?.model ?? ""}</div> : null}
            {showEquipment ? <div className="text-xs text-muted-foreground">{item.source?.name ?? item.acquiredFrom ?? "No vendor recorded"}</div> : null}
            {showEquipment && item.equipmentProfile ? (
              <div className="mt-2 text-xs text-muted-foreground">
                {item.equipmentProfile.lastMaintainedAt ? `Last serviced ${format(item.equipmentProfile.lastMaintainedAt, "MMM d, yyyy")}` : "Never serviced"}
                {item.equipmentProfile.maintenanceIntervalDays ? ` · every ${item.equipmentProfile.maintenanceIntervalDays} days` : ""}
                {equipmentNextDue(item.equipmentProfile) ? ` · next ${format(equipmentNextDue(item.equipmentProfile)!, "MMM d, yyyy")}` : ""}
                {equipmentDue(item.equipmentProfile) ? <span className="ml-2 font-semibold text-amber-700 dark:text-amber-300">maintenance due</span> : null}
              </div>
            ) : null}
          </div>
          <div className="text-right">
            <Badge>{item.itemType}</Badge>
            <div className="mt-2 font-mono text-xs text-muted-foreground">qty {item.quantity} {item.unit ?? ""}</div>
            <div className="mt-2"><MediaUploadButton aquariumId={aquariumId} items={[{ id: item.id, label: item.name }]} defaultItemId={item.id} /></div>
            {showEquipment ? (
              <form action={detachEquipmentFromAquarium} className="mt-2">
                <input type="hidden" name="aquariumId" value={aquariumId} />
                <input type="hidden" name="itemId" value={item.id} />
                <Button type="submit" variant="ghost">Detach</Button>
              </form>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function InhabitantGroup({ aquariumId, title, items, husbandryByItemId, plantLanguage = false }: { aquariumId: string; title: string; items: any[]; husbandryByItemId: Map<string, any>; plantLanguage?: boolean }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">{title}</h3>
      {items.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((item) => (
            <div key={item.id} className="rounded-md border border-border bg-background/55 p-3">
              {item.mediaAssets?.[0] ? <MediaThumbnail asset={item.mediaAssets[0]} className="mb-3 aspect-video w-full" /> : null}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-primary">{item.speciesDefinition?.commonName ?? item.name}</div>
                  <div className="text-sm italic text-muted-foreground">{item.speciesDefinition?.scientificName ?? [item.speciesDefinition?.genus, item.speciesDefinition?.species].filter(Boolean).join(" ")}</div>
                  <div className="mt-2 text-sm text-muted-foreground">{item.notes ?? "No notes yet."}</div>
                </div>
                <Badge>{item.status}</Badge>
              </div>
              <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                <span className="font-mono">qty {item.quantity} {item.unit ?? ""}</span>
                <span>{item.source?.name ?? "No source"}</span>
                <span>{item.acquiredAt ? format(item.acquiredAt, "MMM d, yyyy") : "No date"}</span>
              </div>
              <div className="mt-3 text-xs font-semibold text-muted-foreground">{plantLanguage ? "Use loss/removal to record melt, trim, or removal without deleting history." : "Use loss to reduce quantity while keeping history."}</div>
              <div className="mt-3"><MediaUploadButton aquariumId={aquariumId} items={[{ id: item.id, label: item.name }]} defaultItemId={item.id} /></div>
              {husbandryByItemId.get(item.id) ? (
                <details className="mt-3 rounded-md border border-border bg-muted/35 p-3">
                  <summary className="cursor-pointer font-semibold text-primary">Effective husbandry</summary>
                  <div className="mt-3 space-y-4">
                    <SpeciesHusbandryGuideView
                      speciesType={husbandryByItemId.get(item.id).speciesType}
                      fields={husbandryByItemId.get(item.id).fields}
                      baseFields={husbandryByItemId.get(item.id).guide?.fields}
                      overrideFields={husbandryByItemId.get(item.id).override?.fields}
                      editAction={saveSpeciesHusbandryOverrideFieldAction}
                      editTargetName="aquariumItemId"
                      editTargetId={item.id}
                      title="Effective husbandry"
                    />
                    <details className="rounded-md border border-border bg-background/55 p-3">
                      <summary className="cursor-pointer font-semibold text-primary">Edit local override</summary>
                      <div className="mt-3">
                        <SpeciesHusbandryOverrideForm
                          action={saveSpeciesHusbandryOverrideAction}
                          aquariumItemId={item.id}
                          speciesType={husbandryByItemId.get(item.id).speciesType}
                          override={husbandryByItemId.get(item.id).override}
                        />
                      </div>
                    </details>
                  </div>
                </details>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">No {title.toLowerCase()} recorded for this aquarium yet.</div>
      )}
    </div>
  );
}

function AddInhabitantForm({
  aquariumId,
  speciesDefinitions,
  sources
}: {
  aquariumId: string;
  speciesDefinitions: { id: string; commonName: string; category: string }[];
  sources: { id: string; name: string }[];
}) {
  return (
    <form action={addInhabitant} className="grid gap-3">
      <input type="hidden" name="aquariumId" value={aquariumId} />
      <label className="grid gap-1 text-sm font-medium">
        <span>Type</span>
        <Select name="itemType" defaultValue="FISH">
          <option value="FISH">Fish</option>
          <option value="INVERT">Invertebrate</option>
          <option value="PLANT">Plant</option>
          <option value="OTHER">Coral / other</option>
        </Select>
      </label>
      <label className="grid gap-1 text-sm font-medium">
        <span>Species definition</span>
        <Select name="speciesDefinitionId" defaultValue="">
          <option value="">No linked species</option>
          {speciesDefinitions.map((species) => <option key={species.id} value={species.id}>{species.commonName} · {species.category.toLowerCase()}</option>)}
        </Select>
      </label>
      <Input name="name" placeholder="Display name, e.g. Ember tetra group" required />
      <div className="grid gap-3 sm:grid-cols-2">
        <Input name="quantity" type="number" step="0.01" placeholder="Quantity" defaultValue="1" />
        <Input name="unit" placeholder="Quantity label" />
      </div>
      <Select name="sourceId" defaultValue="">
        <option value="">No source/vendor</option>
        {sources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}
      </Select>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input name="purchasePrice" type="number" step="0.01" placeholder="Purchase price" />
        <Input name="acquiredAt" type="date" />
      </div>
      <Textarea name="notes" placeholder="Acclimation, quarantine, condition, or plant notes" />
      <Button type="submit"><Fish className="mr-2 h-4 w-4" />Add inhabitant</Button>
    </form>
  );
}

function InhabitantLossForm({ aquariumId, items }: { aquariumId: string; items: { id: string; name: string; itemType: string; quantity: number }[] }) {
  return (
    <form action={logInhabitantLoss} className="grid gap-3">
      <input type="hidden" name="aquariumId" value={aquariumId} />
      <Select name="itemId" required>
        <option value="">Choose inhabitant</option>
        {items.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.itemType.toLowerCase()} · qty {item.quantity}</option>)}
      </Select>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input name="quantity" type="number" step="0.01" placeholder="Quantity" defaultValue="1" />
        <Input name="eventDate" type="datetime-local" />
      </div>
      <Input name="suspectedCause" placeholder="Suspected cause or removal reason" />
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" name="removeFromInventory" defaultChecked />
        Reduce inventory quantity
      </label>
      <Textarea name="notes" placeholder="Symptoms, observation, or removal notes" />
      <Button type="submit" variant="secondary">Log loss or removal</Button>
    </form>
  );
}

function InhabitantTransferForm({ items, aquariums, storageLocations, quarantineProjects }: {
  items: { id: string; name: string; quantity: number }[];
  aquariums: { id: string; name: string; generatedName: string | null }[];
  storageLocations: { id: string; name: string }[];
  quarantineProjects: { id: string; name: string }[];
}) {
  return (
    <form action={transferItem} className="grid gap-3">
      <Select name="itemId" required defaultValue=""><option value="">Choose inhabitant</option>{items.map((item) => <option key={item.id} value={item.id}>{item.name} · qty {item.quantity}</option>)}</Select>
      <Select name="destinationType" required defaultValue="AQUARIUM">
        <option value="AQUARIUM">Another aquarium</option><option value="STORAGE">Storage</option><option value="QUARANTINE">Quarantine</option><option value="REMOVED">Remove from active collection</option>
      </Select>
      <Select name="toAquariumId" defaultValue=""><option value="">Destination aquarium, if applicable</option>{aquariums.map((entry) => <option key={entry.id} value={entry.id}>{entry.generatedName ?? entry.name}</option>)}</Select>
      <Select name="toStorageLocationId" defaultValue=""><option value="">Storage location, if applicable</option>{storageLocations.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</Select>
      <Select name="toQuarantineProjectId" defaultValue=""><option value="">Quarantine project, if applicable</option>{quarantineProjects.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</Select>
      <Input name="quantity" type="number" min="0.01" step="0.01" defaultValue="1" />
      <Input name="reason" placeholder="Reason for move" />
      <Button type="submit" variant="secondary">Move inhabitant</Button>
    </form>
  );
}

function ParameterBatchForm({ aquariumId }: { aquariumId: string }) {
  return (
    <form action={createReadingsBatch} className="grid gap-3">
      <input type="hidden" name="aquariumId" value={aquariumId} />
      <Input name="measuredAt" type="datetime-local" />
      <div className="grid gap-3 sm:grid-cols-2">
        {parameterFields.map(([name, label, unit]) => (
          <label key={name} className="grid gap-1 text-sm font-medium">
            <span>{label}</span>
            <div className="grid grid-cols-[1fr_72px] gap-2">
              <Input name={name} type="number" step="0.01" placeholder="Value" />
              <Input name={`${name}Unit`} placeholder={unit} defaultValue={unit} />
            </div>
          </label>
        ))}
      </div>
      <Textarea name="notes" placeholder="Reading notes" />
      <Button type="submit"><Droplets className="mr-2 h-4 w-4" />Log readings</Button>
    </form>
  );
}

function WaterChangeForm({ aquariumId }: { aquariumId: string }) {
  return (
    <form action={logWaterChange} className="grid gap-3">
      <input type="hidden" name="aquariumId" value={aquariumId} />
      <Input name="eventDate" type="datetime-local" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Input name="volumeGallons" type="number" step="0.1" placeholder="Gallons changed" />
        <Input name="percentChanged" type="number" step="1" placeholder="Percent changed" />
      </div>
      <Input name="waterSource" placeholder="Water source" />
      <Input name="conditionerUsed" placeholder="Conditioner used" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Textarea name="beforeNotes" placeholder="Before: condition, observations, or reason" />
        <Textarea name="afterNotes" placeholder="After: result or follow-up observations" />
      </div>
      <Textarea name="parameterNotes" placeholder="Parameter or source-water notes" />
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" name="temperatureMatched" />
        Temperature matched
      </label>
      <Textarea name="notes" placeholder="Water change notes" />
      <Button type="submit"><Droplets className="mr-2 h-4 w-4" />Log water change</Button>
    </form>
  );
}

function MaintenanceForm({ aquariumId, equipmentItems }: { aquariumId: string; equipmentItems: { id: string; name: string; equipmentProfile: { equipmentType: string } | null }[] }) {
  return (
    <form action={createMaintenanceEvent} className="grid gap-3">
      <input type="hidden" name="aquariumId" value={aquariumId} />
      <Select name="maintenanceType" defaultValue="WATER_CHANGE">
        {maintenanceTypes.map((type) => <option key={type}>{type}</option>)}
      </Select>
      <Select name="equipmentItemId" defaultValue="">
        <option value="">No linked equipment</option>
        {equipmentItems.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.equipmentProfile?.equipmentType ?? "equipment"}</option>)}
      </Select>
      <Input name="title" placeholder="Title, e.g. Weekly water change" />
      <Input name="eventDate" type="datetime-local" />
      <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="markMaintained" defaultChecked />Update linked equipment last maintained date</label>
      <Input name="summary" placeholder="Summary" />
      <Textarea name="notes" placeholder="Maintenance notes" />
      <Button type="submit"><Wrench className="mr-2 h-4 w-4" />Log maintenance</Button>
    </form>
  );
}

function FeedingForm({ aquariumId, foodItems, inhabitants }: { aquariumId: string; foodItems: { id: string; name: string }[]; inhabitants: { id: string; name: string; itemType: string }[] }) {
  return (
    <form action={logFeeding} className="grid gap-3">
      <input type="hidden" name="aquariumId" value={aquariumId} />
      <label className="grid gap-1 text-sm font-medium">
        <span>Food</span>
        <Select name="foodItemId" defaultValue="">
          <option value="">No food item linked</option>
          {foodItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </Select>
      </label>
      <Input name="foodName" placeholder="Manual food name if not in inventory" />
      <label className="grid gap-1 text-sm font-medium">
        <span>Fed at</span>
        <Input name="fedAt" type="datetime-local" />
      </label>
      <Input name="title" placeholder="Title, e.g. Morning feeding" />
      <Input name="amount" placeholder="Amount, e.g. 1 pinch" />
      <Select name="targetItemId" defaultValue=""><option value="">Whole tank / no linked target</option>{inhabitants.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.itemType.toLowerCase()}</option>)}</Select>
      <Input name="targetInhabitants" placeholder="Additional target description" />
      <Textarea name="notes" placeholder="Feeding notes" />
      <Button type="submit">Log feeding</Button>
    </form>
  );
}

function MedicationCourseList({ courses }: { courses: any[] }) {
  if (!courses.length) return <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">No medication courses for this tank.</div>;
  return (
    <div className="space-y-3">
      {courses.map((course) => (
        <div key={course.id} className="rounded-md border border-border bg-background/55 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold text-primary">{course.title}</div>
              <div className="text-sm text-muted-foreground">{course.medicationDefinition.name} · {course.reason ?? "No reason recorded"}</div>
              <div className="font-mono text-xs text-muted-foreground">
                {course.calculatedDoseAmount ? `${Number(course.calculatedDoseAmount.toFixed(2))}${course.calculatedDoseUnit ?? ""}` : "manual dose"} · {course.tankVolumeGallons} gal used
              </div>
            </div>
            <Badge>{course.status}</Badge>
          </div>
          <div className="mt-3 space-y-2">
            <form action={logMedicationDose} className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[130px_80px_80px_70px_auto]">
              <input type="hidden" name="medicationCourseId" value={course.id} />
              <Select name="doseType" defaultValue="FOLLOW_UP">
                <option value="ONE_OFF">One-off</option>
                <option value="FOLLOW_UP">Follow-up</option>
                <option value="TREATMENT_COMPLETION">Completion</option>
              </Select>
              <Input name="doseAmount" type="number" step="0.01" placeholder="Dose" defaultValue={course.calculatedDoseAmount ?? ""} />
              <Input name="doseUnit" placeholder="Unit" defaultValue={course.calculatedDoseUnit ?? ""} />
              <Input name="doseNumber" type="number" placeholder="#" defaultValue={(course.doseEvents?.length ?? 0) + 1} />
              <Button type="submit" variant="secondary" className="sm:col-span-2 xl:col-span-1">Log dose</Button>
            </form>
            <div className="flex flex-wrap gap-2">
              <form action={updateMedicationCourseStatus}>
                <input type="hidden" name="id" value={course.id} />
                <input type="hidden" name="status" value="COMPLETED" />
                <Button type="submit" variant="ghost">Complete without another dose</Button>
              </form>
              <form action={updateMedicationCourseStatus}>
                <input type="hidden" name="id" value={course.id} />
                <input type="hidden" name="status" value="CANCELLED" />
                <Button type="submit" variant="ghost">Cancel</Button>
              </form>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CareTaskList({
  tasks
}: {
  tasks: {
    id: string;
    title: string;
    description: string | null;
    dueAt: Date;
    careSchedule: { scheduleType: string; cadenceType: string };
  }[];
}) {
  if (!tasks.length) return <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">No scheduled care tasks for this tank.</div>;
  const today = startOfToday();
  return (
    <div className="space-y-3">
      {tasks.map((task) => {
        const overdue = isBefore(task.dueAt, today);
        return (
          <div key={task.id} className="rounded-md border border-border bg-background/55 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-primary">{task.title}</div>
                <div className="font-mono text-xs text-muted-foreground">due {format(task.dueAt, "MMM d, yyyy")}</div>
                {task.description ? <p className="mt-1 text-sm text-muted-foreground">{task.description}</p> : null}
              </div>
              <Badge className={overdue ? "bg-rose-100 text-rose-950 dark:bg-rose-900/35 dark:text-rose-100" : ""}>{overdue ? "overdue" : task.careSchedule.scheduleType}</Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <form action={completeCareTask}>
                <input type="hidden" name="id" value={task.id} />
                <Button type="submit" variant="secondary">Complete</Button>
              </form>
              <form action={skipCareTask}>
                <input type="hidden" name="id" value={task.id} />
                <Button type="submit" variant="ghost">Skip</Button>
              </form>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CareScheduleList({ schedules }: { schedules: { id: string; name: string; description: string | null; scheduleType: string; cadenceType: string; intervalDays: number | null; nextDueAt: Date | null; enabled: boolean }[] }) {
  if (!schedules.length) return <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">No recurring care schedules for this tank. Create one from Schedules.</div>;
  return (
    <div className="space-y-3">
      {schedules.map((schedule) => (
        <div key={schedule.id} className="rounded-md border border-border bg-background/55 p-3">
          <div className="flex items-start justify-between gap-3">
            <div><div className="font-semibold text-primary">{schedule.name}</div><div className="text-sm text-muted-foreground">{schedule.description ?? "No instructions"}</div></div>
            <Badge>{schedule.enabled ? schedule.scheduleType : "disabled"}</Badge>
          </div>
          <div className="mt-2 font-mono text-xs text-muted-foreground">{schedule.cadenceType.replaceAll("_", " ").toLowerCase()}{schedule.intervalDays ? ` · every ${schedule.intervalDays} days` : ""} · next {schedule.nextDueAt ? format(schedule.nextDueAt, "MMM d, yyyy") : "not generated"}</div>
        </div>
      ))}
    </div>
  );
}

function AquariumLightLoadSummary({ assignments }: { assignments: any[] }) {
  if (!assignments.length) return <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">Assign a light and lighting schedule to estimate daily light load.</div>;
  const results = assignments.map((assignment) => {
    const maxLumens = assignment.equipmentItem?.equipmentProfile?.maxLumens ?? null;
    const estimate = assignment.schedule ? calculateScheduleLightLoad(assignment.schedule.points, assignment.schedule.capabilityProfile, maxLumens) : null;
    return { assignment, maxLumens, estimate };
  });
  const total = results.reduce((sum, result) => sum + (result.estimate?.estimatedLumenHours ?? 0), 0);
  return <div className="rounded-lg border border-border bg-muted/35 p-4"><div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Estimated Daily Light Load</div><div className="mt-3 space-y-3">{results.map(({ assignment, maxLumens, estimate }) => <div key={assignment.id} className="rounded-md bg-background/60 p-3"><div className="font-semibold text-primary">{assignment.equipmentItem?.name ?? "Unlinked light"}</div><div className="mt-1 grid gap-1 text-xs text-muted-foreground sm:grid-cols-3"><span>Max output: {maxLumens ? `${maxLumens.toLocaleString()} lm` : "not recorded"}</span><span>Schedule: {assignment.schedule?.name ?? "not assigned"}</span><span>Equivalent full-output time: {estimate?.equivalentFullOutputHours != null ? `${estimate.equivalentFullOutputHours.toFixed(2)} h` : "—"}</span></div><div className="mt-2 font-mono text-sm font-semibold text-primary">{!assignment.schedule ? "Assign a lighting schedule to estimate daily light load." : estimate?.estimatedLumenHours == null ? "Add max lumens to the light fixture to estimate daily light load." : estimate.displayValue}</div></div>)}</div>{total > 0 ? <div className="mt-3 border-t border-border pt-3 font-mono font-semibold text-primary">Total estimated daily light load: {formatLightLoad(total)}</div> : null}<p className="mt-3 text-xs text-muted-foreground">Estimated Daily Light Load is a comparative estimate based on fixture lumens and schedule intensity over time. It is not a PAR measurement.</p></div>;
}

function ScheduleSummary({ schedule }: { schedule: { name: string; capabilityProfile: { channels: unknown; mode?: string } | null; points: { id: string; timeOfDay: string; white: number; red: number; green: number; blue: number; warmWhite: number | null; intensity: number | null; rampMinutes?: number; values: unknown }[] } }) {
  return (
    <div className="mt-4 rounded-md bg-muted/45 p-3">
      <div className="font-semibold text-primary">{schedule.name}</div>
      <div className="mt-3">
        <LightingSchedulePreview points={schedule.points} profile={schedule.capabilityProfile} />
      </div>
      <div className="mt-2 grid gap-2">
        {schedule.points.map((point) => (
          <div key={point.id} className="flex items-center justify-between gap-3 text-xs">
            <span className="font-mono">{point.timeOfDay}</span>
            <span className="font-mono text-muted-foreground">{Object.entries(valuesForPoint(point)).map(([key, value]) => `${key} ${value}`).join(" · ")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
