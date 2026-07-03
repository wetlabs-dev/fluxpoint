import Link from "next/link";
import { notFound } from "next/navigation";
import { differenceInCalendarDays, format, isBefore, startOfToday } from "date-fns";
import { Droplets, Fish, KeyRound, LineChart, ListPlus, Pill, RefreshCw, Utensils, Wrench } from "lucide-react";
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
import { addInhabitant, assignLightingSchedule, clearLightingAssignment, completeCareTask, completeWorkflowStep, createMaintenanceEvent, createReadingsBatch, detachEquipmentFromAquarium, logFeeding, logInhabitantLoss, logMedicationDose, logWaterChange, saveSpeciesHusbandryOverrideAction, skipCareTask, startWorkflow, updateMedicationCourseStatus } from "@/domains/management/actions";
import { formatReading } from "@/lib/format/readings";
import { buildLocationPath } from "@/lib/format/location";
import { ensureAquariumMetricConfigs } from "@/domains/metrics/metrics-service";
import { LightingSchedulePreview } from "@/components/lighting/lighting-schedule-preview";
import { LightingAssignmentForm } from "@/components/lighting/LightingAssignmentForm";
import { calculateScheduleLightLoad, formatLightLoad } from "@/domains/lighting/light-load";
import { valuesForPoint } from "@/domains/lighting/capabilities";
import { getEffectiveHusbandryForItem } from "@/domains/husbandry/husbandry-service";
import { SpeciesHusbandryOverrideForm } from "@/components/husbandry/SpeciesHusbandryOverrideForm";
import { HusbandryBadges } from "@/components/husbandry/HusbandryBadges";
import { getHusbandrySectionsForSpeciesType, normalizeHusbandryFields } from "@/domains/husbandry/husbandry-fields";
import { MediaUploadButton } from "@/components/media/MediaUploadButton";
import { MediaGallery } from "@/components/media/MediaGallery";
import { MediaThumbnail } from "@/components/media/MediaThumbnail";
import { AquariumPhotoStrip } from "@/components/media/AquariumPhotoStrip";
import { TankMetricChart } from "@/components/aquarium/TankMetricChart";
import { ItemizedReceipt } from "@/components/inventory/ItemizedReceipt";
import { PublicInventoryRowSelector } from "@/components/public/PublicInventoryRowSelector";
import { AquariumEquipmentAttachForm } from "@/components/equipment/AquariumEquipmentAttachForm";
import { queryAquariumMetricHistory } from "@/domains/metrics/prometheus-query";
import { MedicationStartForm } from "@/components/aquarium/MedicationStartForm";
import { InhabitantTransferForm } from "@/components/aquarium/InhabitantTransferForm";
import { AddInhabitantForm } from "@/components/aquarium/AddInhabitantForm";
import { aquariumEquipmentRoleLabels, aquariumEquipmentRoles } from "@/domains/aquariums/equipment-attachments";
import { habitatsForSalinity, speciesMatchesAquariumTarget } from "@/domains/species/habitat";
import { getCollectionRole, isServerAdmin } from "@/domains/auth/permissions";
import { ConditionBadge } from "@/components/conditions/ConditionBadge";
import { ConditionCreateForm } from "@/components/conditions/ConditionCreateForm";
import { activeConditionStatuses } from "@/domains/conditions/condition-catalog";
import { LabelActions } from "@/components/labels/LabelActions";
import { EddyParameterAdvisor } from "@/components/eddy/EddyParameterAdvisor";
import { getQuantityMin, getQuantityStep } from "@/domains/inventory/quantity";
import { formatFishSexBreakdown } from "@/domains/inventory/fish-sex";
import { EddyStockingPressure } from "@/components/eddy/EddyStockingPressure";
import { getLatestStockingPressureState, publicEstimate } from "@/domains/aquariums/stocking-pressure";
import { saveAquariumPublicSettings } from "@/domains/public/actions";
import { publicAquariumPath } from "@/domains/public/public-utils";
import { formatDateTimeLocalInput, userTimeZone } from "@/lib/dates/user-timezone";
import { AdditionalContentsPanel } from "@/components/aquarium/AdditionalContentsPanel";
import { formatInhabitantGroupQuantity, groupAquariumInhabitants } from "@/domains/aquariums/inhabitant-groups";

export const dynamic = "force-dynamic";

const workspaceTabs = [
  ["overview", "Overview"],
  ["inhabitants", "Inhabitants"],
  ["equipment", "Equipment"],
  ["metrics", "Metrics"],
  ["conditions", "Conditions"],
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
  ["livestock", "Livestock"], ["MAINTENANCE", "Maintenance"], ["NOTE", "Notes"], ["conditions", "Conditions"]
] as const;

export default async function AquariumDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ metricToken?: string; timelineType?: string; workspace?: string; conditionId?: string }> }) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const timeZone = userTimeZone(user);
  const [collectionRole, serverAdmin] = await Promise.all([getCollectionRole(user.id, collection.id), isServerAdmin(user.id)]);
  const canConfirmRestricted = collectionRole === "COLLECTION_OWNER" || serverAdmin;
  const eddyStatus = aiProviderStatus();
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const requestedWorkspace = resolvedSearchParams?.workspace ?? (resolvedSearchParams?.timelineType ? "timeline" : "overview");
  const selectedWorkspace: WorkspaceTab = workspaceTabs.some(([value]) => value === requestedWorkspace) ? requestedWorkspace as WorkspaceTab : "overview";
  const aquarium = await prisma.aquarium.findFirst({
    where: { id, collectionId: collection.id },
    include: {
      profile: true,
      additionalContents: { where: { archivedAt: null }, orderBy: [{ category: "asc" }, { createdAt: "asc" }] },
      equipmentAttachments: { include: { item: { include: { publicProfile: true, equipmentProfile: { include: { lightCapabilityProfile: true } }, aquariumAttachments: { include: { aquarium: { select: { id: true, name: true, generatedName: true } } } } } } }, orderBy: [{ role: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }] },
      coverMediaAsset: true,
      structuredLocation: { include: { parent: { include: { parent: true } } } },
      lightingAssignments: { include: { schedule: { include: { capabilityProfile: true, points: { orderBy: { sortOrder: "asc" } } } }, equipmentItem: { include: { equipmentProfile: { include: { lightCapabilityProfile: true } } } } } },
      items: {
        include: { publicProfile: true, equipmentProfile: true, speciesDefinition: { include: { husbandryGuide: true } }, speciesVariant: true, husbandryOverride: true, source: true, mediaAssets: { where: { moderationStatus: "APPROVED", hiddenAt: null }, orderBy: { createdAt: "desc" }, take: 1 } },
        orderBy: { updatedAt: "desc" }
      },
      publicProfile: true,
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
      tankAuditSessions: { where: { status: { in: ["OPEN", "IN_PROGRESS"] } }, orderBy: { openedAt: "desc" }, take: 1 },
      healthConditions: { where: { status: { in: activeConditionStatuses } }, include: { _count: { select: { observations: true, careTasks: true } } }, orderBy: [{ severity: "desc" }, { lastObservedAt: "desc" }] },
      workflowRuns: {
        where: { status: { in: ["RUNNING", "ACTIVE", "PAUSED"] } },
        include: {
          workflowTemplate: true,
          stepRuns: { include: { workflowStep: true }, orderBy: { sortOrder: "asc" } }
        },
        orderBy: { startedAt: "desc" }
      },
      aiSuggestions: { orderBy: { createdAt: "desc" }, take: 8 }
    }
  });

  if (!aquarium) notFound();
  const collectionPublicProfile = await prisma.collectionPublicProfile.findUnique({ where: { collectionId: collection.id } });
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
    where: { collectionId: collection.id, status: { notIn: ["ARCHIVED", "CONSUMED", "DEAD", "REMOVED"] }, itemType: { in: ["SUBSTRATE", "EQUIPMENT"] } },
    include: { equipmentProfile: { include: { lightCapabilityProfile: true } }, aquarium: true, storageLocation: true, aquariumAttachments: { include: { aquarium: { select: { id: true, name: true, generatedName: true } } } } },
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
  const templates = await prisma.workflowTemplate.findMany({
    where: { OR: [{ collectionId: collection.id }, { collectionId: null }], status: "ACTIVE" },
    include: { steps: { orderBy: [{ sortOrder: "asc" }, { order: "asc" }] } },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }]
  });
  const qrCodes = await prisma.qrCode.findMany({ where: { collectionId: collection.id, entityType: "TANK", entityId: aquarium.id }, orderBy: { createdAt: "desc" }, take: 4 });
  const generatedLabels = await prisma.generatedLabel.findMany({ where: { collectionId: collection.id, entityType: "TANK", entityId: aquarium.id }, orderBy: { createdAt: "desc" }, take: 12 });
  const speciesDefinitions = await prisma.speciesDefinition.findMany({
    where: { OR: [{ collectionId: collection.id }, { collectionId: null }] },
    include: {
      regionalStatuses: { where: { collectionId: collection.id } },
      variants: {
        where: { collectionId: collection.id, archivedAt: null },
        orderBy: [{ variantType: "asc" }, { name: "asc" }]
      }
    },
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
      where: { collectionId: collection.id, status: { notIn: ["ARCHIVED", "CONSUMED", "DEAD", "REMOVED"] }, itemType: { in: ["SUBSTRATE", "EQUIPMENT"] }, aquariumAttachments: { none: { aquariumId: aquarium.id } } },
      include: { equipmentProfile: true, aquarium: true, storageLocation: true, aquariumAttachments: { include: { aquarium: { select: { id: true, name: true, generatedName: true } } } } },
      orderBy: { name: "asc" }
    })
  ]);

  const equipmentItems = profileItems.map((item) => ({ id: item.id, label: [item.name, item.equipmentProfile?.equipmentType ?? item.itemType.toLowerCase(), item.aquarium?.generatedName ?? item.aquarium?.name ?? item.storageLocation?.name ?? "unassigned"].filter(Boolean).join(" · "), itemType: item.itemType, equipmentType: item.equipmentProfile?.equipmentType ?? null }));
  const equipmentAttachOptions = availableEquipment.map((item) => {
    const attachedAquariums = item.aquariumAttachments.map((attachment) => ({ id: attachment.aquarium.id, name: attachment.aquarium.generatedName ?? attachment.aquarium.name }));
    const placement = attachedAquariums.length > 1
      ? `shared across ${attachedAquariums.length} tanks`
      : attachedAquariums[0]?.name ?? item.aquarium?.generatedName ?? item.aquarium?.name ?? item.storageLocation?.name ?? "unassigned";
    return {
      id: item.id,
      name: item.name,
      label: [item.name, item.equipmentProfile?.equipmentType ?? item.itemType.toLowerCase(), placement].filter(Boolean).join(" · "),
      equipmentType: item.equipmentProfile?.equipmentType ?? null,
      multiAquariumCapable: Boolean(item.equipmentProfile?.multiAquariumCapable),
      attachedAquariums
    };
  });
  const duplicateEquipmentOptions = profileItems.filter((item) => item.itemType === "EQUIPMENT").map((item) => {
    const attachedAquariums = item.aquariumAttachments.map((attachment) => ({ id: attachment.aquarium.id, name: attachment.aquarium.generatedName ?? attachment.aquarium.name }));
    const placement = attachedAquariums.length > 1
      ? `shared across ${attachedAquariums.length} tanks`
      : attachedAquariums[0]?.name ?? item.aquarium?.generatedName ?? item.aquarium?.name ?? item.storageLocation?.name ?? "unassigned";
    return {
      id: item.id,
      name: item.name,
      label: [item.name, item.equipmentProfile?.equipmentType ?? "equipment", placement].filter(Boolean).join(" · "),
      equipmentType: item.equipmentProfile?.equipmentType ?? null,
      multiAquariumCapable: Boolean(item.equipmentProfile?.multiAquariumCapable),
      attachedAquariums
    };
  });
  const lightItems = aquarium.equipmentAttachments.filter((attachment) => attachment.role === "LIGHT" && attachment.item.equipmentProfile?.equipmentType === "LIGHT").map((attachment) => ({
    id: attachment.item.id,
    label: attachment.item.name,
    capabilityProfileId: attachment.item.equipmentProfile?.lightCapabilityProfileId ?? null,
    capabilityProfileName: attachment.item.equipmentProfile?.lightCapabilityProfile?.name ?? null,
    capabilityProfile: attachment.item.equipmentProfile?.lightCapabilityProfile ?? null,
    maxLumens: attachment.item.equipmentProfile?.maxLumens ?? null,
    wattage: attachment.item.equipmentProfile?.wattage ?? null,
    efficacyLumensPerWatt: attachment.item.equipmentProfile?.efficacyLumensPerWatt ?? null,
    outputEstimateMethod: attachment.item.equipmentProfile?.outputEstimateMethod ?? "UNKNOWN"
  }));
  const locationOptions = locations.map((location) => ({ id: location.id, label: buildLocationPath(location) }));
  const activeTankItems = aquarium.items.filter((item) => ["ACTIVE", "IN_AQUARIUM"].includes(item.status) && item.storageLocationId == null && item.quarantineProjectId == null);
  const livestock = activeTankItems.filter((item) => ["FISH", "INVERT"].includes(item.itemType));
  const plants = activeTankItems.filter((item) => item.itemType === "PLANT");
  const corals = activeTankItems.filter((item) => ["BOTANICAL", "OTHER"].includes(item.itemType) && item.speciesDefinition?.category === "CORAL");
  const otherInhabitants = activeTankItems.filter((item) => ["BOTANICAL", "OTHER"].includes(item.itemType) && item.speciesDefinition?.category !== "CORAL");
  const allInhabitants = [...livestock, ...plants, ...corals, ...otherInhabitants];
  const husbandryEntries = await Promise.all(allInhabitants.filter((item) => item.speciesDefinitionId).map(async (item) => [item.id, await getEffectiveHusbandryForItem(item.id)] as const));
  const husbandryByItemId = new Map(husbandryEntries);
  const equipment = aquarium.equipmentAttachments.filter((attachment) => attachment.item.itemType === "EQUIPMENT").map((attachment) => attachment.item);
  const tankReceiptItems = Array.from(new Map([...aquarium.items, ...aquarium.equipmentAttachments.map((attachment) => attachment.item)].map((item) => [item.id, item])).values());
  const publicInventoryOptions = Array.from(new Map([
    ...aquarium.items.filter((item) => ["FISH", "INVERT", "CORAL", "PLANT", "EQUIPMENT", "SUBSTRATE", "HARDSCAPE"].includes(item.itemType)),
    ...aquarium.equipmentAttachments.map((attachment) => attachment.item).filter((item) => ["EQUIPMENT", "SUBSTRATE", "HARDSCAPE"].includes(item.itemType))
  ].map((item) => [item.id, { id: item.id, name: item.name, itemType: item.itemType, selected: Boolean(item.publicProfile?.isPublished) }])).values());
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
  const timelineTypes = requestedTimelineType === "livestock" ? ["LIVESTOCK_ADDITION", "LIVESTOCK_LOSS", "PLANT_ADDITION", "PLANT_REMOVAL", "STOCKING", "DEATH"] : requestedTimelineType === "conditions" ? ["CONDITION_CREATED", "CONDITION_OBSERVATION", "CONDITION_STATUS_CHANGED", "CONDITION_RESOLVED", "CONDITION_LINKED_MEDICATION", "EQUIPMENT_ISSUE_LOGGED"] : [requestedTimelineType];
  const filteredEvents = requestedTimelineType === "all" ? aquarium.events : aquarium.events.filter((event) => timelineTypes.includes(event.eventType));
  const estimatedVolume = aquarium.lengthInches && aquarium.widthInches && aquarium.heightInches
    ? aquarium.lengthInches * aquarium.widthInches * aquarium.heightInches / 231
    : null;
  const tankAgeDays = aquarium.startedAt ? differenceInCalendarDays(new Date(), aquarium.startedAt) : null;
  const aquariumHabitats = habitatsForSalinity(aquarium.targetSalinityMinPpt, aquarium.targetSalinityMaxPpt);
  const compatibleSpeciesDefinitions = speciesDefinitions.filter((definition) => speciesMatchesAquariumTarget(aquarium.targetSalinityMinPpt, aquarium.targetSalinityMaxPpt, definition.salinityMin, definition.salinityMax));
  const inhabitantSections = buildInhabitantSections({
    habitats: aquariumHabitats,
    targetSalinityMaxPpt: aquarium.targetSalinityMaxPpt,
    fish: livestock.filter((item) => item.itemType === "FISH"),
    invertebrates: livestock.filter((item) => item.itemType === "INVERT"),
    plants,
    corals,
    other: otherInhabitants
  });
  const stockingPressureState = selectedWorkspace === "overview" ? await getLatestStockingPressureState(aquarium.id, user.id, collection.id) : null;
  const canManageAdditionalContents = collectionRole === "COLLECTION_OWNER" || collectionRole === "AQUARIST";

  return (
    <div className="space-y-6">
      <PageHeader title={aquarium.generatedName ?? aquarium.name} eyebrow={aquarium.name}>
        <div className="flex flex-wrap gap-2">
          {aquariumHabitats.map((habitat) => <Badge key={habitat}>✓ {habitat}</Badge>)}
          <Badge>{aquarium.aquariumType.replace("_", " ")}</Badge>
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
              <div className="absolute inset-0 bg-gradient-to-br from-slate-950/80 via-slate-950/35 to-slate-950/75" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 via-slate-950/45 to-transparent p-6 pt-24 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.65)]"><div className="font-display text-4xl">{aquarium.generatedName ?? aquarium.name}</div><div className="text-sm text-white/90">{aquarium.coverMediaAsset.caption || "Aquarium workspace"}</div></div>
            </div>
          ) : (
            <div className="relative grid min-h-48 place-items-center overflow-hidden bg-gradient-to-br from-slate-950 via-teal-950 to-cyan-800 p-6 text-center text-white">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(94,234,212,0.28),transparent_30%),radial-gradient(circle_at_80%_75%,rgba(56,189,248,0.22),transparent_34%)]" />
              <div className="absolute inset-0 bg-slate-950/35" />
              <div className="relative drop-shadow-[0_2px_8px_rgba(0,0,0,0.65)]"><div className="font-display text-4xl">{aquarium.generatedName ?? aquarium.name}</div><p className="mt-2 text-sm text-white/90">Add an approved photo or generate an Eddy cover to make it the aquarium header.</p></div>
            </div>
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
              <Info label="Lighting schedules" value={aquarium.lightingAssignments.filter((entry) => entry.enabled && entry.schedule).map((entry) => `${entry.equipmentItem?.name ?? "Light"}: ${entry.schedule?.name}`).join(" · ") || aquarium.profile?.lightingSchedule} />
              <Info label="Water source" value={aquarium.profile?.waterSource} />
              <Info label="Target water" value={[`${aquarium.targetSalinityMinPpt ?? "?"}–${aquarium.targetSalinityMaxPpt ?? "?"} ppt`, aquarium.profile?.targetTemperature ? `${aquarium.profile.targetTemperature}F` : null, aquarium.profile?.targetPh ? `pH ${aquarium.profile.targetPh}` : null, aquarium.profile?.targetGh ? `GH ${aquarium.profile.targetGh}` : null, aquarium.profile?.targetKh ? `KH ${aquarium.profile.targetKh}` : null].filter(Boolean).join(" · ") || null} />
              <div className="space-y-3 md:col-span-2 xl:col-span-3">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Equipment profile</div>
                {aquarium.equipmentAttachments.length ? <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{groupAttachments(aquarium.equipmentAttachments).map(([role, attachments]) => <div key={role} className="rounded-md bg-muted/50 p-3"><div className="text-xs font-semibold text-primary">{aquariumEquipmentRoleLabels[role]}</div><div className="mt-1 text-sm">{attachments.map((attachment) => attachment.item.name).join(" · ")}</div></div>)}</div> : <div className="text-sm text-muted-foreground">No equipment attached.</div>}
              </div>
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
              <QuickAction href={`/aquariums/${aquarium.id}?workspace=conditions#condition-form`} label="Log condition" />
              <QuickAction href={`/breeding?aquariumId=${aquarium.id}`} label="Breeding project" />
              <QuickAction href={`/aquariums/${aquarium.id}/audit${aquarium.tankAuditSessions[0] ? `/${aquarium.tankAuditSessions[0].id}` : ""}`} label={aquarium.tankAuditSessions[0] ? "Continue tank audit" : "Start tank audit"} />
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
          <SummaryStat label="Inhabitants" value={`${allInhabitants.reduce((sum, item) => sum + item.quantity, 0)} total`} detail={`${allInhabitants.length} records`} />
          <SummaryStat label="Equipment" value={equipment.length} detail={equipment.some((item) => equipmentDue(item.equipmentProfile)) ? "Maintenance due" : "No overdue service"} />
          <SummaryStat label="Schedules" value={aquarium.careSchedules.filter((schedule) => schedule.enabled).length} detail={`${aquarium.careTasks.length} upcoming tasks`} />
          <SummaryStat label="Activity" value={aquarium.events.length ? format(aquarium.events[0].eventDate, "MMM d") : "None"} detail={aquarium.events[0]?.title ?? "No events yet"} />
          <SummaryStat label="Medication" value={aquarium.medicationCourses.filter((course) => course.status === "ACTIVE").length ? "Active" : "None"} detail={aquarium.medicationCourses.find((course) => course.status === "ACTIVE")?.medicationDefinition.name ?? "No active course"} />
        </div>
        {stockingPressureState ? <EddyStockingPressure aquariumId={aquarium.id} initialEstimate={stockingPressureState.latest ? publicEstimate(stockingPressureState.latest) : null} initialEligible={stockingPressureState.eligible} initialStale={stockingPressureState.stale} /> : null}
        <AdditionalContentsPanel aquariumId={aquarium.id} rows={aquarium.additionalContents} canEdit={canManageAdditionalContents} compact />
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
              {inhabitantSections.map((section) => (
                <InhabitantGroup
                  key={section.key}
                  aquariumId={aquarium.id}
                  salinityMin={aquarium.targetSalinityMinPpt}
                  salinityMax={aquarium.targetSalinityMaxPpt}
                  title={section.title}
                  items={section.items}
                  husbandryByItemId={husbandryByItemId}
                  timeZone={timeZone}
                  plantLanguage={section.plantLanguage}
                />
              ))}
              <AdditionalContentsPanel aquariumId={aquarium.id} rows={aquarium.additionalContents} canEdit={canManageAdditionalContents} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Fish className="h-5 w-5 text-water" /> Add Inhabitant</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <AddInhabitantForm aquariumId={aquarium.id} speciesDefinitions={compatibleSpeciesDefinitions} sources={sources} salinityHabitats={aquariumHabitats} canConfirmRestricted={canConfirmRestricted} />
              <div>
                <h3 className="mb-2 text-sm font-semibold text-primary">Log loss or removal</h3>
                <InhabitantLossForm aquariumId={aquarium.id} items={[...livestock, ...plants]} timeZone={timeZone} />
              </div>
              <div className="border-t border-border pt-5">
                <h3 className="mb-2 text-sm font-semibold text-primary">Move an inhabitant</h3>
                <InhabitantTransferForm
                  items={allInhabitants}
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
            {aquarium.equipmentAttachments.length ? (
              <div className="space-y-4">
                {groupAttachments(aquarium.equipmentAttachments).map(([role, attachments]) => (
                  <div key={role}>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{aquariumEquipmentRoleLabels[role]}</h3>
                    <div className="grid gap-2">
                      {attachments.map((attachment) => {
                        const attachedCount = attachment.item.aquariumAttachments.length;
                        const isShared = Boolean(attachment.item.equipmentProfile?.multiAquariumCapable);
                        const sharedWarning = attachedCount > 1 && !isShared;
                        return (
                          <div key={attachment.id} className="flex items-start justify-between gap-3 rounded-md border border-border bg-background/55 p-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Link className="font-semibold text-primary hover:underline" href={`/equipment/${attachment.item.id}`}>{attachment.item.name}</Link>
                                {isShared ? <Badge>Shared equipment</Badge> : null}
                                {sharedWarning ? <Badge className="bg-amber-100 text-amber-950 dark:bg-amber-950/45 dark:text-amber-100">Multi-tank warning</Badge> : null}
                              </div>
                              <div className="text-xs text-muted-foreground">{attachment.item.equipmentProfile?.equipmentType ?? attachment.item.itemType}{attachedCount > 1 ? ` · ${attachedCount} aquariums` : ""}{attachment.notes ? ` · ${attachment.notes}` : ""}</div>
                              <Link className="mt-1 inline-block text-xs font-semibold text-primary underline" href={`/equipment/${attachment.item.id}?view=labels`}>Open / print label</Link>
                            </div>
                            <form action={detachEquipmentFromAquarium}><input type="hidden" name="aquariumId" value={aquarium.id} /><input type="hidden" name="attachmentId" value={attachment.id} /><Button type="submit" variant="ghost">Detach</Button></form>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">No equipment attached.</div>}
            <AquariumEquipmentAttachForm
              aquariumId={aquarium.id}
              roles={aquariumEquipmentRoles.map((role) => ({ value: role, label: aquariumEquipmentRoleLabels[role] }))}
              equipment={equipmentAttachOptions}
              duplicateSources={duplicateEquipmentOptions}
            />
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
          <CardContent><MaintenanceForm aquariumId={aquarium.id} equipmentItems={equipment} timeZone={timeZone} /></CardContent>
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
                  <ParameterBatchForm aquariumId={aquarium.id} timeZone={timeZone} />
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
          <CardContent><WaterChangeForm aquariumId={aquarium.id} timeZone={timeZone} /></CardContent>
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

      {selectedWorkspace === "conditions" ? (
      <section id="conditions" className="scroll-mt-20 grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader><div className="flex items-center justify-between gap-3"><CardTitle>Active conditions</CardTitle><Link href={`/conditions?aquariumId=${aquarium.id}`} className="text-sm font-semibold text-primary underline">All condition history</Link></div></CardHeader>
          <CardContent className="space-y-3">
            {aquarium.healthConditions.length ? aquarium.healthConditions.map((condition) => <Link key={condition.id} href={`/conditions/${condition.id}`} className="block rounded-md border border-border bg-background/55 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-semibold text-primary">{condition.title}</div><div className="text-sm text-muted-foreground">{condition.conditionType} · {condition._count.observations} observations · {condition._count.careTasks} follow-ups</div></div><div className="flex gap-2"><ConditionBadge value={condition.severity} kind="severity" /><ConditionBadge value={condition.status} /></div></div>{condition.summary ? <p className="mt-2 text-sm text-muted-foreground">{condition.summary}</p> : null}</Link>) : <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No active conditions are recorded for this aquarium.</div>}
          </CardContent>
        </Card>
        <Card id="condition-form" className="scroll-mt-24">
          <CardHeader><CardTitle>Log aquarium condition</CardTitle></CardHeader>
          <CardContent>{collectionRole === "COLLECTION_OWNER" || collectionRole === "AQUARIST" ? <ConditionCreateForm timeZone={timeZone} defaults={{ aquariumId: aquarium.id, entityType: "AQUARIUM" }} aquariums={[{ id: aquarium.id, label: aquarium.generatedName ?? aquarium.name }]} items={aquarium.items.map((item) => ({ id: item.id, label: `${item.name} · ${item.itemType.toLowerCase()}` }))} species={compatibleSpeciesDefinitions.map((entry) => ({ id: entry.id, label: entry.commonName }))} /> : <p className="text-sm text-muted-foreground">Aquarist access is required to create a condition. Fishkeepers can add observations to existing records.</p>}</CardContent>
        </Card>
      </section>
      ) : null}

      {selectedWorkspace === "timeline" ? (
      <section id="timeline" className="scroll-mt-20 grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <Card id="event-form" className="scroll-mt-24">
          <CardHeader><CardTitle>Add timeline event</CardTitle></CardHeader>
          <CardContent><EventCreateForm aquariumId={aquarium.id} items={aquarium.items} timeZone={timeZone} /></CardContent>
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
          <CardContent><FeedingForm aquariumId={aquarium.id} foodItems={foodItems} inhabitants={allInhabitants} timeZone={timeZone} /></CardContent>
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
          <CardContent><MedicationStartForm aquariumId={aquarium.id} conditionId={resolvedSearchParams?.conditionId} initialVolumeGallons={aquarium.volumeGallons} initialVolumeUnit={aquarium.volumeUnit} definitions={medicationDefinitions} timeZone={timeZone} /></CardContent>
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
            {aquarium.workflowRuns.length ? aquarium.workflowRuns.map((run) => {
              const completed = run.stepRuns.filter((step) => ["COMPLETED", "SKIPPED"].includes(step.status)).length;
              const nextStep = run.stepRuns.find((step) => !["COMPLETED", "SKIPPED", "CANCELLED"].includes(step.status));
              return (
              <div key={run.id} className="rounded-md border border-border bg-background/45 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><div className="font-semibold">{run.title || run.workflowTemplate.name}</div><div className="font-mono text-sm text-muted-foreground">{run.status} · {completed}/{run.stepRuns.length} steps</div></div>
                  <Link href={`/workflows/runs/${run.id}`} className="text-sm font-semibold text-primary underline">Open run</Link>
                </div>
                {nextStep ? <form action={completeWorkflowStep} className="mt-3 flex items-center justify-between gap-3 rounded-md bg-muted/45 p-2"><input type="hidden" name="id" value={nextStep.id} /><span className="text-sm">Next: {nextStep.titleSnapshot || nextStep.workflowStep.title}</span><Button type="submit" variant="secondary">Complete</Button></form> : null}
              </div>
            );}) : <p className="text-sm text-muted-foreground">No active workflows for this tank.</p>}
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
      <section id="eddy-studio" className="scroll-mt-20 space-y-5">
        <EddyParameterAdvisor aquariumId={aquarium.id} />
        <EddyAquariumSummary aquariumId={aquarium.id} provider={eddyStatus.provider} fallbackActive={eddyStatus.fallbackActive} imageEnabled={eddyStatus.imageEnabled} initialImageUsage={imageUsage} />
      </section>
      ) : null}

      {selectedWorkspace === "settings" ? (
        <section className="grid gap-5 xl:grid-cols-2">
          <Card id="qr-labels" className="scroll-mt-20">
            <CardHeader><CardTitle>QR / Labels</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <LabelActions entityType="TANK" entityId={aquarium.id} canGenerate={collectionRole !== "VIEWER"} allowedTypes={["SIMPLE_QR", "TANK_DETAIL", "AQUARIUM_LIVESTOCK_SHEET"]} labels={generatedLabels} />
              {qrCodes.map((qr) => <div key={qr.id} className="rounded-md bg-muted/55 p-3"><div className="font-semibold">Stable scan destination</div><code className="block break-all font-mono text-xs text-muted-foreground">{qr.payload}</code></div>)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Edit tank profile</CardTitle></CardHeader>
            <CardContent className="space-y-5"><EddyParameterAdvisor aquariumId={aquarium.id} compact /><AquariumForm aquarium={aquarium} locations={locationOptions} equipmentItems={equipmentItems} /></CardContent>
          </Card>
      <AdditionalContentsPanel aquariumId={aquarium.id} rows={aquarium.additionalContents} canEdit={canManageAdditionalContents} />
      <Card>
        <CardHeader><CardTitle>Tank cost receipt</CardTitle><p className="text-sm text-muted-foreground">Breakdown uses unit price × current quantity for items currently assigned to this aquarium.</p></CardHeader>
        <CardContent><ItemizedReceipt items={tankReceiptItems.map((item) => ({ id: item.id, name: item.name, itemType: item.itemType, quantity: item.quantity, unit: item.unit, purchasePrice: item.purchasePrice }))} /></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Public aquarium view</CardTitle><p className="text-sm text-muted-foreground">Preview safely before publishing. Selected inventory rows only become public when checked here.</p></CardHeader>
        <CardContent>
          <form action={saveAquariumPublicSettings} className="grid gap-3 md:grid-cols-2">
            <input type="hidden" name="aquariumId" value={aquarium.id} />
            <label className="flex items-center gap-2 md:col-span-2"><input type="checkbox" name="isPublished" defaultChecked={Boolean(aquarium.publicProfile?.isPublished)} /> Publish this aquarium when collection public browse is enabled</label>
            <Input name="publicSlug" placeholder="public-slug" defaultValue={aquarium.publicProfile?.publicSlug ?? (aquarium.generatedName ?? aquarium.name).toLowerCase().replace(/[^a-z0-9]+/g, "-")} />
            <Input name="publicTitle" placeholder="Public title" defaultValue={aquarium.publicProfile?.publicTitle ?? aquarium.generatedName ?? aquarium.name} />
            <Input name="publicSubtitle" placeholder="Subtitle" defaultValue={aquarium.publicProfile?.publicSubtitle ?? ""} />
            <Textarea className="md:col-span-2" name="publicDescription" placeholder="Public description" defaultValue={aquarium.publicProfile?.publicDescription ?? aquarium.description ?? ""} />
            <div className="grid gap-2 text-sm md:col-span-2 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["showCoverPhoto", "Cover photo", true],
                ["showInhabitants", "Inhabitants", true],
                ["showPlants", "Plants", true],
                ["showEquipment", "Equipment", false],
                ["showMetrics", "Water metrics", false],
                ["showSchedules", "Schedules", false],
                ["showTimeline", "Timeline highlights", false],
                ["showConditions", "Conditions", false],
                ["showStockingPressure", "Stocking pressure", true],
                ["showEddySummary", "Eddy summary", false]
              ].map(([name, label, fallback]) => <label key={String(name)} className="flex items-center gap-2 rounded-md bg-muted/45 p-2"><input type="checkbox" name={String(name)} defaultChecked={aquarium.publicProfile ? Boolean((aquarium.publicProfile as any)[String(name)]) : Boolean(fallback)} /> {label}</label>)}
            </div>
            <PublicInventoryRowSelector items={publicInventoryOptions} />
            <div className="flex flex-wrap gap-3 md:col-span-2"><Button type="submit">Save public aquarium settings</Button><Link href={`/browse-preview/${aquarium.id}`} className="inline-flex min-h-10 items-center rounded-md border border-border px-4 py-2 text-sm font-semibold text-primary">Preview public page</Link>{collectionPublicProfile && aquarium.publicProfile ? <Link href={publicAquariumPath(collectionPublicProfile.publicSlug, aquarium.publicProfile.publicSlug)} className="inline-flex min-h-10 items-center rounded-md border border-border px-4 py-2 text-sm font-semibold text-primary">Open public URL</Link> : null}</div>
            {collectionPublicProfile && aquarium.publicProfile ? <p className="text-xs text-muted-foreground md:col-span-2">Public URL: {publicAquariumPath(collectionPublicProfile.publicSlug, aquarium.publicProfile.publicSlug)}</p> : null}
          </form>
        </CardContent>
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

function buildInhabitantSections({
  habitats,
  targetSalinityMaxPpt,
  fish,
  invertebrates,
  plants,
  corals,
  other
}: {
  habitats: string[];
  targetSalinityMaxPpt: number | null;
  fish: any[];
  invertebrates: any[];
  plants: any[];
  corals: any[];
  other: any[];
}) {
  const hasMarineHabitat = habitats.includes("Marine");
  const hasBrackishHabitat = habitats.includes("Brackish");
  const highBrackishTarget = hasBrackishHabitat && !hasMarineHabitat && (targetSalinityMaxPpt ?? 0) >= 25;
  const shouldShowCorals = hasMarineHabitat || corals.length > 0 || highBrackishTarget;
  const plantTitle = hasMarineHabitat ? "Plants & Macroalgae" : "Plants";

  const shared = {
    fish: { key: "fish", title: "Fish", items: fish, plantLanguage: false },
    invertebrates: { key: "invertebrates", title: "Invertebrates", items: invertebrates, plantLanguage: false },
    plants: { key: "plants", title: plantTitle, items: plants, plantLanguage: true },
    corals: { key: "corals", title: "Corals", items: corals, plantLanguage: false },
    other: { key: "other", title: "Other", items: other, plantLanguage: false }
  };

  if (hasMarineHabitat) return [shared.fish, shared.corals, shared.invertebrates, shared.plants, shared.other];
  return [
    shared.fish,
    shared.invertebrates,
    shared.plants,
    ...(shouldShowCorals ? [shared.corals] : []),
    shared.other
  ];
}

function InhabitantGroup({ aquariumId, salinityMin, salinityMax, title, items, husbandryByItemId, timeZone, plantLanguage = false }: { aquariumId: string; salinityMin: number | null; salinityMax: number | null; title: string; items: any[]; husbandryByItemId: Map<string, any>; timeZone: string; plantLanguage?: boolean }) {
  const groups = groupAquariumInhabitants(items);
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">{title}</h3>
      {groups.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {groups.map((group) => {
            const item = group.primaryItem;
            const husbandryItem = group.husbandryItem ?? item;
            const sexBreakdown = formatFishSexBreakdown({
              ...item,
              quantity: group.totalQuantity,
              maleCountApprox: group.items.some((batch) => batch.maleCountApprox != null) ? group.items.reduce((sum, batch) => sum + (batch.maleCountApprox ?? 0), 0) : null,
              femaleCountApprox: group.items.some((batch) => batch.femaleCountApprox != null) ? group.items.reduce((sum, batch) => sum + (batch.femaleCountApprox ?? 0), 0) : null
            });
            return (
            <div key={group.key} className="rounded-md border border-border bg-background/55 p-3">
              {group.items.find((batch) => batch.mediaAssets?.[0])?.mediaAssets?.[0] ? <MediaThumbnail asset={group.items.find((batch) => batch.mediaAssets?.[0])!.mediaAssets[0]} className="mb-3 aspect-video w-full" /> : null}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-primary">{group.displayName}</div>
                  <div className="text-sm italic text-muted-foreground">{group.scientificName}</div>
                  {group.variantName ? <div className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Variant · {group.variantName}</div> : null}
                  <div className="mt-2 text-sm text-muted-foreground">{group.notesSummary ?? (group.batchCount > 1 ? "Batch notes are preserved in Additions." : "No notes yet.")}</div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge>{group.status}</Badge>
                  {group.batchCount > 1 ? <Badge>{group.batchCount} batches</Badge> : null}
                </div>
              </div>
              <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                <span className="font-mono">{formatInhabitantGroupQuantity(group)}</span>
                <span>{group.sourceSummary}</span>
                <span>{group.dateSummary}</span>
              </div>
              {sexBreakdown ? <div className="mt-2 rounded-md bg-muted/45 p-2 text-xs font-semibold text-primary">{sexBreakdown}</div> : null}
              {item.speciesDefinition && !speciesMatchesAquariumTarget(salinityMin, salinityMax, item.speciesDefinition.salinityMin, item.speciesDefinition.salinityMax) ? <div className="mt-3 rounded-md border border-amber-400/45 bg-amber-500/10 p-2 text-xs font-semibold text-amber-700 dark:text-amber-200">Species salinity range does not match this aquarium’s target salinity range.</div> : null}
              <div className="mt-3 text-xs font-semibold text-muted-foreground">{plantLanguage ? "Use loss/removal to record melt, trim, or removal without deleting history." : "Use loss to reduce quantity while keeping history."}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <MediaUploadButton aquariumId={aquariumId} items={group.items.map((batch) => ({ id: batch.id, label: `${batch.name} · ${batch.quantity} ${batch.unit ?? "units"}` }))} defaultItemId={item.id} />
                <Link href={`/inventory/${item.id}`} className="inline-flex min-h-10 items-center rounded-md border border-border px-3 text-sm font-semibold text-primary hover:bg-muted">Open inventory</Link>
              </div>
              <details className="mt-3 rounded-md border border-border bg-muted/25 p-3" open={group.batchCount === 1}>
                <summary className="cursor-pointer text-sm font-semibold text-primary">Additions / batches</summary>
                <div className="mt-3 grid gap-2">
                  {group.items.map((batch) => (
                    <div key={batch.id} className="rounded-md bg-background/70 p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-mono text-primary">qty {batch.quantity} {batch.unit ?? ""}</div>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <Badge>{batch.status}</Badge>
                          <Link href={`/inventory/${batch.id}`} className="font-semibold text-primary underline">Inventory detail</Link>
                        </div>
                      </div>
                      <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                        <span>{batch.source?.name ?? batch.acquiredFrom ?? "No source"}</span>
                        <span>{batch.acquiredAt ? format(batch.acquiredAt, "MMM d, yyyy") : "No date"}</span>
                      </div>
                      {batch.notes ? <p className="mt-2 text-sm text-muted-foreground">{batch.notes}</p> : null}
                    </div>
                  ))}
                </div>
              </details>
              <details className="mt-3 rounded-md border border-border bg-background/55 p-3">
                <summary className="cursor-pointer text-sm font-semibold text-primary">Log loss or removal from this group</summary>
                <form action={logInhabitantLoss} className="mt-3 grid gap-3">
                  <input type="hidden" name="aquariumId" value={aquariumId} />
                  <input type="hidden" name="timeZone" value={timeZone} />
                  {group.batchCount > 1 ? (
                    <Select name="itemId" required defaultValue={item.id}>
                      {group.items.map((batch) => <option key={batch.id} value={batch.id}>{batch.quantity} {batch.unit ?? "units"} · {batch.source?.name ?? batch.acquiredFrom ?? "No source"} · {batch.acquiredAt ? format(batch.acquiredAt, "MMM d, yyyy") : "No date"}</option>)}
                    </Select>
                  ) : <input type="hidden" name="itemId" value={item.id} />}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input name="quantity" type="number" min={getQuantityMin(group.itemType)} step={getQuantityStep(group.itemType)} placeholder="Quantity" defaultValue="1" />
                    <Input name="eventDate" type="datetime-local" defaultValue={formatDateTimeLocalInput(new Date(), timeZone)} />
                  </div>
                  <Input name="suspectedCause" placeholder="Suspected cause or removal reason" />
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input type="checkbox" name="removeFromInventory" defaultChecked />
                    Reduce inventory quantity
                  </label>
                  <Textarea name="notes" placeholder="Symptoms, observation, or removal notes" />
                  <Button type="submit" variant="secondary">Log loss or removal</Button>
                </form>
              </details>
              {husbandryByItemId.get(husbandryItem.id) ? <HusbandrySummaryPreview item={husbandryItem} husbandry={husbandryByItemId.get(husbandryItem.id)} /> : null}
            </div>
          );})}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">No {title.toLowerCase()} recorded for this aquarium yet.</div>
      )}
    </div>
  );
}

function HusbandrySummaryPreview({ item, husbandry }: { item: any; husbandry: any }) {
  const speciesType = husbandry.speciesType;
  const values = normalizeHusbandryFields(speciesType, husbandry.fields);
  const summarySection = getHusbandrySectionsForSpeciesType(speciesType).find((section) => section.key === "summary");
  const rows = (summarySection?.fields ?? []).filter((field) => values[field.key]);
  return (
    <div className="mt-3 rounded-md border border-border bg-muted/35 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-semibold text-primary">Husbandry summary</h4>
        {item.speciesDefinitionId ? <Link className="text-xs font-semibold text-primary underline" href={`/species/${item.speciesDefinitionId}#husbandry`}>Open full husbandry</Link> : null}
      </div>
      <div className="mt-2"><HusbandryBadges type={speciesType} fields={husbandry.fields} /></div>
      {rows.length ? (
        <dl className="mt-3 grid gap-2 text-sm">
          {rows.map((field) => (
            <div key={field.key} className="rounded-md bg-background/70 p-2">
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{field.label}</dt>
              <dd className="mt-1 whitespace-pre-wrap text-primary">{values[field.key]}</dd>
            </div>
          ))}
        </dl>
      ) : <p className="mt-3 text-sm text-muted-foreground">No summary fields are filled yet. Open the full husbandry guide for the complete record.</p>}
      {husbandry.override ? (
        <details className="mt-3 rounded-md border border-border bg-background/55 p-3">
          <summary className="cursor-pointer text-xs font-semibold text-primary">Edit local override</summary>
          <div className="mt-3">
            <SpeciesHusbandryOverrideForm
              action={saveSpeciesHusbandryOverrideAction}
              aquariumItemId={item.id}
              speciesType={speciesType}
              override={husbandry.override}
            />
          </div>
        </details>
      ) : null}
    </div>
  );
}

function groupAttachments(attachments: any[]) {
  const groups = new Map<keyof typeof aquariumEquipmentRoleLabels, any[]>();
  for (const attachment of attachments) {
    const role = attachment.role as keyof typeof aquariumEquipmentRoleLabels;
    groups.set(role, [...(groups.get(role) ?? []), attachment]);
  }
  return [...groups.entries()];
}

function InhabitantLossForm({ aquariumId, items, timeZone }: { aquariumId: string; items: { id: string; name: string; itemType: string; quantity: number }[]; timeZone: string }) {
  return (
    <form action={logInhabitantLoss} className="grid gap-3">
      <input type="hidden" name="aquariumId" value={aquariumId} />
      <input type="hidden" name="timeZone" value={timeZone} />
      <Select name="itemId" required>
        <option value="">Choose inhabitant</option>
        {items.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.itemType.toLowerCase()} · qty {item.quantity}</option>)}
      </Select>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input name="quantity" type="number" min={getQuantityMin("FISH")} step={getQuantityStep("FISH")} placeholder="Quantity" defaultValue="1" />
        <Input name="eventDate" type="datetime-local" defaultValue={formatDateTimeLocalInput(new Date(), timeZone)} />
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

function ParameterBatchForm({ aquariumId, timeZone }: { aquariumId: string; timeZone: string }) {
  return (
    <form action={createReadingsBatch} className="grid gap-3">
      <input type="hidden" name="aquariumId" value={aquariumId} />
      <input type="hidden" name="timeZone" value={timeZone} />
      <Input name="measuredAt" type="datetime-local" defaultValue={formatDateTimeLocalInput(new Date(), timeZone)} />
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

function WaterChangeForm({ aquariumId, timeZone }: { aquariumId: string; timeZone: string }) {
  return (
    <form action={logWaterChange} className="grid gap-3">
      <input type="hidden" name="aquariumId" value={aquariumId} />
      <input type="hidden" name="timeZone" value={timeZone} />
      <Input name="eventDate" type="datetime-local" defaultValue={formatDateTimeLocalInput(new Date(), timeZone)} />
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

function MaintenanceForm({ aquariumId, equipmentItems, timeZone }: { aquariumId: string; equipmentItems: { id: string; name: string; equipmentProfile: { equipmentType: string } | null }[]; timeZone: string }) {
  return (
    <form action={createMaintenanceEvent} className="grid gap-3">
      <input type="hidden" name="aquariumId" value={aquariumId} />
      <input type="hidden" name="timeZone" value={timeZone} />
      <Select name="maintenanceType" defaultValue="WATER_CHANGE">
        {maintenanceTypes.map((type) => <option key={type}>{type}</option>)}
      </Select>
      <Select name="equipmentItemId" defaultValue="">
        <option value="">No linked equipment</option>
        {equipmentItems.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.equipmentProfile?.equipmentType ?? "equipment"}</option>)}
      </Select>
      <Input name="title" placeholder="Title, e.g. Weekly water change" />
      <Input name="eventDate" type="datetime-local" defaultValue={formatDateTimeLocalInput(new Date(), timeZone)} />
      <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="markMaintained" defaultChecked />Update linked equipment last maintained date</label>
      <Input name="summary" placeholder="Summary" />
      <Textarea name="notes" placeholder="Maintenance notes" />
      <Button type="submit"><Wrench className="mr-2 h-4 w-4" />Log maintenance</Button>
    </form>
  );
}

function FeedingForm({ aquariumId, foodItems, inhabitants, timeZone }: { aquariumId: string; foodItems: { id: string; name: string }[]; inhabitants: { id: string; name: string; itemType: string }[]; timeZone: string }) {
  return (
    <form action={logFeeding} className="grid gap-3">
      <input type="hidden" name="aquariumId" value={aquariumId} />
      <input type="hidden" name="timeZone" value={timeZone} />
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
        <Input name="fedAt" type="datetime-local" defaultValue={formatDateTimeLocalInput(new Date(), timeZone)} />
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
    const output = assignment.equipmentItem?.equipmentProfile ?? null;
    const estimate = assignment.enabled && assignment.schedule ? calculateScheduleLightLoad(assignment.schedule.points, assignment.schedule.capabilityProfile, output, assignment.schedule.rampMinutes) : null;
    const exclusion = !assignment.enabled ? "disabled assignment" : !assignment.schedule ? "no schedule" : !estimate?.estimatedMaxLumens ? "no lumens or wattage" : null;
    return { assignment, estimate, exclusion };
  });
  const total = results.reduce((sum, result) => sum + (result.exclusion ? 0 : result.estimate?.estimatedLumenHours ?? 0), 0);
  return <div className="rounded-lg border border-border bg-muted/35 p-4"><div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Estimated Daily Light Load</div><div className="mt-3 space-y-3">{results.map(({ assignment, estimate, exclusion }) => <div key={assignment.id} className="rounded-md bg-background/60 p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div className="font-semibold text-primary">{assignment.equipmentItem?.name ?? "Unlinked light"}</div><div className="flex gap-2">{estimate?.outputMethod === "WATTAGE_ESTIMATED" ? <Badge>estimated from wattage</Badge> : null}<Badge>{exclusion ? "excluded" : `${estimate?.confidence.toLowerCase()} confidence`}</Badge></div></div><div className="mt-1 grid gap-1 text-xs text-muted-foreground sm:grid-cols-3"><span>Output: {estimate?.description ?? assignment.equipmentItem?.equipmentProfile?.outputEstimateMethod?.toLowerCase().replaceAll("_", " ") ?? "unknown"}</span><span>Schedule: {assignment.schedule?.name ?? "not assigned"}</span><span>Equivalent full-output time: {estimate?.equivalentFullOutputHours != null ? `${estimate.equivalentFullOutputHours.toFixed(2)} h` : "—"}</span></div><div className="mt-2 font-mono text-sm font-semibold text-primary">{exclusion ? `Excluded: ${exclusion}.` : estimate?.displayValue}</div></div>)}</div>{total > 0 ? <div className="mt-3 border-t border-border pt-3 font-mono font-semibold text-primary">Total estimated daily light load: {formatLightLoad(total)}</div> : <div className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">No eligible light contributions to total.</div>}<p className="mt-3 text-xs text-muted-foreground">Estimated Daily Light Load compares fixtures and schedules using rated lumens or a clearly labeled wattage-derived estimate. It is not a PAR measurement.</p></div>;
}

function ScheduleSummary({ schedule }: { schedule: { name: string; rampMinutes: number; capabilityProfile: { channels: unknown; mode?: string } | null; points: { id: string; timeOfDay: string; white: number; red: number; green: number; blue: number; warmWhite: number | null; intensity: number | null; rampMinutes?: number; values: unknown }[] } }) {
  return (
    <div className="mt-4 rounded-md bg-muted/45 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><div className="font-semibold text-primary">{schedule.name}</div><Badge>{schedule.rampMinutes} min ramp</Badge></div>
      <div className="mt-3">
        <LightingSchedulePreview points={schedule.points} profile={schedule.capabilityProfile} rampMinutes={schedule.rampMinutes} />
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
