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
import { addInhabitant, assignLightingSchedule, clearLightingAssignment, completeCareTask, completeWorkflowStep, createMaintenanceEvent, createReadingsBatch, generateQrCode, logFeeding, logInhabitantLoss, logMedicationDose, logWaterChange, saveSpeciesHusbandryOverrideAction, saveSpeciesHusbandryOverrideFieldAction, skipCareTask, startMedicationCourse, startWorkflow, updateMedicationCourseStatus } from "@/domains/management/actions";
import { formatReading } from "@/lib/format/readings";
import { buildLocationPath } from "@/lib/format/location";
import { ensureAquariumMetricConfigs } from "@/domains/metrics/metrics-service";
import { LightingSchedulePreview } from "@/components/lighting/lighting-schedule-preview";
import { valuesForPoint } from "@/domains/lighting/capabilities";
import { getEffectiveHusbandryForItem } from "@/domains/husbandry/husbandry-service";
import { SpeciesHusbandryGuideView } from "@/components/husbandry/SpeciesHusbandryGuideView";
import { SpeciesHusbandryOverrideForm } from "@/components/husbandry/SpeciesHusbandryOverrideForm";

export const dynamic = "force-dynamic";

const workspaceTabs = [
  ["#overview", "Overview"],
  ["#inhabitants", "Inhabitants"],
  ["#equipment", "Equipment"],
  ["#metrics", "Metrics"],
  ["#timeline", "Timeline"],
  ["#schedules", "Schedules"],
  ["#eddy-studio", "Eddy"],
  ["#qr-labels", "QR / Labels"]
] as const;

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

export default async function AquariumDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ metricToken?: string }> }) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const eddyStatus = aiProviderStatus();
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const aquarium = await prisma.aquarium.findFirst({
    where: { id, collectionId: collection.id },
    include: {
      profile: true,
      structuredLocation: { include: { parent: { include: { parent: true } } } },
      lightingAssignments: { include: { schedule: { include: { capabilityProfile: true, points: { orderBy: { sortOrder: "asc" } } } }, equipmentItem: { include: { equipmentProfile: { include: { lightCapabilityProfile: true } } } } } },
      items: {
        include: { equipmentProfile: true, speciesDefinition: { include: { husbandryGuide: true } }, husbandryOverride: true, source: true },
        orderBy: { updatedAt: "desc" }
      },
      readings: { orderBy: { measuredAt: "desc" }, take: 80 },
      careTasks: {
        where: { status: "PENDING" },
        include: { careSchedule: true },
        orderBy: { dueAt: "asc" },
        take: 12
      },
      events: {
        include: {
          createdBy: true,
          relatedItem: true,
          relatedSpecies: true,
          waterChangeEvent: true,
          feedingEvent: { include: { foodItem: true } },
          maintenanceEvent: { include: { equipmentItem: { include: { equipmentProfile: true } } } },
          medicationDoseEvent: { include: { medicationCourse: { include: { medicationDefinition: true } } } },
          relatedMedicationCourse: { include: { medicationDefinition: true } },
          readings: true
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
  const imageUsage = await getRemainingEddyUsage({ userId: user.id, collectionId: collection.id, featureKey: "COVER_IMAGE_GENERATION" });
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

  const substrateItems = profileItems.filter((item) => item.itemType === "SUBSTRATE").map((item) => ({ id: item.id, label: item.name }));
  const lightItems = profileItems.filter((item) => item.equipmentProfile?.equipmentType === "LIGHT").map((item) => ({
    id: item.id,
    label: item.name,
    capabilityProfileId: item.equipmentProfile?.lightCapabilityProfileId ?? null,
    capabilityProfileName: item.equipmentProfile?.lightCapabilityProfile?.name ?? null
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
          <Badge className="font-mono">{aquarium.volumeGallons ?? "?"} gallons</Badge>
          <form action={archiveAquarium}>
            <input type="hidden" name="id" value={aquarium.id} />
            <Button type="submit" variant="secondary">Archive aquarium</Button>
          </form>
        </div>
      </PageHeader>

      <nav className="sticky top-0 z-10 -mx-2 flex gap-2 overflow-x-auto border-y border-border bg-background/90 px-2 py-2 backdrop-blur">
        {workspaceTabs.map(([href, label]) => (
          <a key={href} href={href} className="shrink-0 rounded-md px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-primary">
            {label}
          </a>
        ))}
      </nav>

      <section id="overview" className="scroll-mt-20 space-y-5">
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
              <Info label="Target water" value={[aquarium.profile?.targetTemperature ? `${aquarium.profile.targetTemperature}F` : null, aquarium.profile?.targetPh ? `pH ${aquarium.profile.targetPh}` : null].filter(Boolean).join(" · ") || null} />
              <div className="md:col-span-2 xl:col-span-3 text-sm text-muted-foreground">{aquarium.description ?? "No description yet."}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
            <CardContent className="grid gap-2">
              <QuickAction href={`/inventory?type=FISH&aquariumId=${aquarium.id}`} label="Add livestock" />
              <QuickAction href={`/inventory?type=PLANT&aquariumId=${aquarium.id}`} label="Add plant" />
              <QuickAction href="/equipment" label="Add equipment" />
              <QuickAction href="#timeline" label="Log event" />
              <QuickAction href="#water-change-form" label="Log water change" />
              <QuickAction href="#feeding-form" label="Log feeding" />
              <QuickAction href="#metrics" label="Log parameter" />
              <QuickAction href="#maintenance-form" label="Add maintenance" />
              <QuickAction href="#medication-form" label="Start medication" />
              <QuickAction href="#qr-labels" label="Generate QR" />
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Latest readings</CardTitle></CardHeader>
            <CardContent><LatestReadings readings={[...latestByParameter.values()].slice(0, 6)} /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Recent activity</CardTitle></CardHeader>
            <CardContent><TimelineList events={aquarium.events.slice(0, 4)} /></CardContent>
          </Card>
        </div>
      </section>

      <section id="inhabitants" className="scroll-mt-20 space-y-5">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Card>
            <CardHeader><CardTitle>Inhabitants</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <InhabitantGroup title="Fish" items={livestock.filter((item) => item.itemType === "FISH")} husbandryByItemId={husbandryByItemId} />
              <InhabitantGroup title="Invertebrates" items={livestock.filter((item) => item.itemType === "INVERT")} husbandryByItemId={husbandryByItemId} />
              <InhabitantGroup title="Plants" items={plants} husbandryByItemId={husbandryByItemId} plantLanguage />
              <InhabitantGroup title="Coral / Other" items={coralOther} husbandryByItemId={husbandryByItemId} />
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
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="equipment" className="scroll-mt-20 grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader><CardTitle>Equipment</CardTitle></CardHeader>
          <CardContent><ItemList items={equipment} emptyText="No equipment assigned." showEquipment /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Lighting assignment</CardTitle></CardHeader>
          <CardContent className="space-y-4">
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
            <form action={assignLightingSchedule} className="grid gap-3 rounded-md border border-border bg-background/60 p-3">
              <input type="hidden" name="aquariumId" value={aquarium.id} />
              <Select name="equipmentItemId" defaultValue={assignment?.equipmentItemId ?? aquarium.profile?.lightItemId ?? ""} required>
                <option value="">Choose light fixture</option>
                {lightItems.map((item) => <option key={item.id} value={item.id}>{item.label}{item.capabilityProfileName ? ` · ${item.capabilityProfileName}` : ""}</option>)}
              </Select>
              <Select name="scheduleId" defaultValue={assignment?.scheduleId ?? ""}>
                <option value="">No lighting schedule</option>
                {lightingSchedules.map((schedule) => <option key={schedule.id} value={schedule.id}>{schedule.name}{schedule.capabilityProfile ? ` · ${schedule.capabilityProfile.name}` : ""}</option>)}
              </Select>
              <Textarea name="lightingAssignmentNotes" placeholder="Lighting notes" defaultValue={assignment?.notes ?? ""} />
              <Button type="submit">Save lighting assignment</Button>
            </form>
            <p className="text-xs text-muted-foreground">Fluxpoint validates fixture compatibility when you save, so RGBW lights only receive RGBW schedules.</p>
          </CardContent>
        </Card>
        <Card id="maintenance-form" className="xl:col-span-2">
          <CardHeader><CardTitle>Log equipment or tank maintenance</CardTitle></CardHeader>
          <CardContent><MaintenanceForm aquariumId={aquarium.id} equipmentItems={equipment} /></CardContent>
        </Card>
      </section>

      <section id="metrics" className="scroll-mt-20 space-y-5">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><LineChart className="h-5 w-5 text-water" /> Metrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
                <div>
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
          <CardHeader><CardTitle>Graphs</CardTitle></CardHeader>
          <CardContent className="grid gap-4 xl:grid-cols-2">
            {metricConfigs.slice(0, 8).map((config) => {
              const panel = config.graphPanels[0];
              return (
                <div key={config.id} className="rounded-md border border-border bg-background/55 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-primary">{config.metricDefinition.displayName}</div>
                      <div className="text-xs text-muted-foreground">{panel?.dashboard?.status ?? "pending"} dashboard panel</div>
                    </div>
                    <Badge>{config.metricDefinition.unit}</Badge>
                  </div>
                  {panel?.embedPath ? (
                    <iframe title={`${config.metricDefinition.displayName} graph`} src={panel.embedPath} className="mt-3 h-64 w-full rounded-md border border-border" />
                  ) : (
                    <div className="mt-3 flex h-40 items-center justify-center rounded-md border border-dashed border-border bg-muted/35 text-center text-sm text-muted-foreground">
                      Grafana is managed internally. Set GRAFANA_PUBLIC_URL and GRAFANA_EMBED_MODE=iframe to embed panels here.
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </section>

      <section className="scroll-mt-20 grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <Card>
          <CardHeader><CardTitle id="water-change-form">Log water change</CardTitle></CardHeader>
          <CardContent><WaterChangeForm aquariumId={aquarium.id} /></CardContent>
        </Card>
        <Card>
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
            <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">Mini-history charts are prepared for this space once the charting layer lands.</div>
          </CardContent>
        </Card>
      </section>

      <section id="timeline" className="scroll-mt-20 grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <Card>
          <CardHeader><CardTitle>Add timeline event</CardTitle></CardHeader>
          <CardContent><EventCreateForm aquariumId={aquarium.id} items={aquarium.items} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {["all", "WATER_CHANGE", "FEEDING", "TEST_RESULT", "MAINTENANCE", "MEDICATION", "LIVESTOCK_ADDITION", "LIVESTOCK_LOSS"].map((type) => (
                <a key={type} href={type === "all" ? "#timeline" : `#event-${type}`} className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted">{type.replaceAll("_", " ").toLowerCase()}</a>
              ))}
            </div>
            <TimelineList events={aquarium.events} />
          </CardContent>
        </Card>
      </section>

      <section id="schedules" className="scroll-mt-20 grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <Card>
          <CardHeader><CardTitle id="feeding-form">Log feeding</CardTitle></CardHeader>
          <CardContent><FeedingForm aquariumId={aquarium.id} foodItems={foodItems} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Scheduled care</CardTitle></CardHeader>
          <CardContent><CareTaskList tasks={aquarium.careTasks} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle id="medication-form" className="flex items-center gap-2"><Pill className="h-5 w-5 text-water" /> Start medication course</CardTitle></CardHeader>
          <CardContent><MedicationCourseForm aquarium={aquarium} definitions={medicationDefinitions} /></CardContent>
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
        <Card id="qr-labels" className="scroll-mt-20">
          <CardHeader><CardTitle>QR / Labels</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <form action={generateQrCode}>
              <input type="hidden" name="entityType" value="Aquarium" />
              <input type="hidden" name="entityId" value={aquarium.id} />
              <input type="hidden" name="label" value={aquarium.generatedName ?? aquarium.name} />
              <Button type="submit"><QrCode className="mr-2 h-4 w-4" />Generate tank QR payload</Button>
            </form>
            {qrCodes.map((qr) => (
              <div key={qr.id} className="rounded-md bg-muted/55 p-3">
                <div className="font-semibold">{qr.label}</div>
                <code className="block break-all font-mono text-xs text-muted-foreground">{qr.payload}</code>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section id="eddy-studio" className="scroll-mt-20">
        <EddyAquariumSummary aquariumId={aquarium.id} provider={eddyStatus.provider} fallbackActive={eddyStatus.fallbackActive} imageEnabled={eddyStatus.imageEnabled} initialImageUsage={imageUsage} />
      </section>

      <Card>
        <CardHeader><CardTitle>Edit tank profile</CardTitle></CardHeader>
        <CardContent><AquariumForm aquarium={aquarium} locations={locationOptions} substrateItems={substrateItems} lightItems={lightItems} heaterItems={heaterItems} /></CardContent>
      </Card>
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

function LatestReadings({ readings }: { readings: { id: string; parameter: string; value: number; unit: string; measuredAt: Date }[] }) {
  if (!readings.length) return <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">No readings yet.</div>;
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {readings.map((reading) => (
        <div key={reading.id} className="rounded-md bg-muted/55 p-3">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{reading.parameter}</div>
          <div className="font-mono text-xl font-semibold text-primary">{formatReading(reading.parameter, reading.value, reading.unit)}</div>
          <div className="font-mono text-xs text-muted-foreground">{format(reading.measuredAt, "MMM d h:mm a")}</div>
        </div>
      ))}
    </div>
  );
}

function ItemList({ items, emptyText, showEquipment = false }: { items: any[]; emptyText: string; showEquipment?: boolean }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="flex items-start justify-between gap-3 rounded-md border border-border bg-background/45 p-3">
          <div>
            <div className="font-semibold text-primary">{item.name}</div>
            <div className="text-sm text-muted-foreground">
              {item.speciesDefinition?.commonName ?? item.description ?? item.equipmentProfile?.equipmentType ?? item.itemType.toLowerCase()}
            </div>
            {showEquipment ? <div className="font-mono text-xs text-muted-foreground">{item.equipmentProfile?.brand ?? "Unbranded"} {item.equipmentProfile?.model ?? ""}</div> : null}
          </div>
          <div className="text-right">
            <Badge>{item.itemType}</Badge>
            <div className="mt-2 font-mono text-xs text-muted-foreground">qty {item.quantity} {item.unit ?? ""}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function InhabitantGroup({ title, items, husbandryByItemId, plantLanguage = false }: { title: string; items: any[]; husbandryByItemId: Map<string, any>; plantLanguage?: boolean }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">{title}</h3>
      {items.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((item) => (
            <div key={item.id} className="rounded-md border border-border bg-background/55 p-3">
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

function FeedingForm({ aquariumId, foodItems }: { aquariumId: string; foodItems: { id: string; name: string }[] }) {
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
      <Input name="targetInhabitants" placeholder="Targets, e.g. ember tetras" />
      <Textarea name="notes" placeholder="Feeding notes" />
      <Button type="submit">Log feeding</Button>
    </form>
  );
}

function MedicationCourseForm({
  aquarium,
  definitions
}: {
  aquarium: { id: string; volumeGallons: number | null };
  definitions: { id: string; name: string; defaultDoseAmount: number | null; defaultDoseUnit: string | null; dosePerGallons: number | null }[];
}) {
  return (
    <form action={startMedicationCourse} className="grid gap-3">
      <input type="hidden" name="aquariumId" value={aquarium.id} />
      <Select name="medicationDefinitionId" required>
        <option value="">Choose medication definition</option>
        {definitions.map((definition) => (
          <option key={definition.id} value={definition.id}>
            {definition.name}{definition.defaultDoseAmount && definition.dosePerGallons ? ` · ${definition.defaultDoseAmount}${definition.defaultDoseUnit ?? ""} per ${definition.dosePerGallons} gal` : ""}
          </option>
        ))}
      </Select>
      {!definitions.length ? <Link className="text-sm font-semibold text-primary underline" href="/medications">Create a medication definition first</Link> : null}
      <Input name="title" placeholder="Course title" />
      <Input name="reason" placeholder="Reason" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Input name="tankVolumeGallons" type="number" step="0.1" placeholder="Tank volume used" defaultValue={aquarium.volumeGallons ?? ""} />
        <Input name="calculatedDoseAmount" type="number" step="0.01" placeholder="Dose override" />
        <Input name="calculatedDoseUnit" placeholder="Dose unit" />
      </div>
      <Input name="startedAt" type="datetime-local" />
      <Textarea name="doseSchedule" placeholder="Dose schedule notes" />
      <Textarea name="notes" placeholder="Medication notes" />
      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100">Verify medication label directions before dosing.</div>
      <Button type="submit"><Pill className="mr-2 h-4 w-4" />Start medication</Button>
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
          <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto_auto]">
            <form action={logMedicationDose} className="grid gap-2 md:grid-cols-[90px_90px_90px_auto]">
              <input type="hidden" name="medicationCourseId" value={course.id} />
              <Input name="doseAmount" type="number" step="0.01" placeholder="Dose" defaultValue={course.calculatedDoseAmount ?? ""} />
              <Input name="doseUnit" placeholder="Unit" defaultValue={course.calculatedDoseUnit ?? ""} />
              <Input name="doseNumber" type="number" placeholder="#" defaultValue={(course.doseEvents?.length ?? 0) + 1} />
              <Button type="submit" variant="secondary">Log dose</Button>
            </form>
            <form action={updateMedicationCourseStatus}>
              <input type="hidden" name="id" value={course.id} />
              <input type="hidden" name="status" value="COMPLETED" />
              <Button type="submit" variant="ghost">Complete</Button>
            </form>
            <form action={updateMedicationCourseStatus}>
              <input type="hidden" name="id" value={course.id} />
              <input type="hidden" name="status" value="CANCELLED" />
              <Button type="submit" variant="ghost">Cancel</Button>
            </form>
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

function ScheduleSummary({ schedule }: { schedule: { name: string; capabilityProfile: { channels: unknown } | null; points: { id: string; timeOfDay: string; white: number; red: number; green: number; blue: number; warmWhite: number | null; intensity: number | null; values: unknown }[] } }) {
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
