import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { Droplets, ListPlus, QrCode, Wrench } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { AquariumForm } from "@/components/aquarium/aquarium-form";
import { archiveAquarium } from "@/domains/aquariums/actions";
import { AiStudio } from "@/components/ai/ai-studio";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { EventCreateForm } from "@/components/aquarium/EventCreateForm";
import { TimelineList } from "@/components/aquarium/TimelineList";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { assignLightingSchedule, completeWorkflowStep, createMaintenanceEvent, createReadingsBatch, generateQrCode, startWorkflow } from "@/domains/management/actions";
import { formatReading } from "@/lib/format/readings";
import { buildLocationPath } from "@/lib/format/location";

export const dynamic = "force-dynamic";

const workspaceTabs = [
  ["#overview", "Overview"],
  ["#livestock", "Livestock"],
  ["#plants", "Plants"],
  ["#equipment", "Equipment"],
  ["#parameters", "Parameters"],
  ["#timeline", "Timeline"],
  ["#maintenance", "Maintenance"],
  ["#ai-studio", "AI Studio"],
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

const maintenanceTypes = ["WATER_CHANGE", "FILTER_SERVICE", "GLASS_CLEANING", "SUBSTRATE_VACUUM", "PLANT_TRIM", "EQUIPMENT_INSPECTION", "DOSING", "OTHER"];

export default async function AquariumDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const { id } = await params;
  const aquarium = await prisma.aquarium.findFirst({
    where: { id, collectionId: collection.id },
    include: {
      profile: true,
      structuredLocation: { include: { parent: { include: { parent: true } } } },
      lightingAssignments: { include: { schedule: { include: { points: { orderBy: { sortOrder: "asc" } } } }, equipmentItem: true } },
      items: {
        include: { equipmentProfile: true, speciesDefinition: true, source: true },
        orderBy: { updatedAt: "desc" }
      },
      readings: { orderBy: { measuredAt: "desc" }, take: 80 },
      events: {
        include: { createdBy: true, relatedItem: true },
        orderBy: { eventDate: "desc" },
        take: 60
      },
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

  const locations = await prisma.location.findMany({
    where: { collectionId: collection.id },
    include: { parent: { include: { parent: true } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
  });
  const profileItems = await prisma.aquariumItem.findMany({
    where: { collectionId: collection.id, status: "ACTIVE", OR: [{ itemType: "SUBSTRATE" }, { itemType: "EQUIPMENT", equipmentProfile: { is: { equipmentType: "LIGHT" } } }] },
    include: { equipmentProfile: true },
    orderBy: { name: "asc" }
  });
  const lightingSchedules = await prisma.lightingSchedule.findMany({
    where: { collectionId: collection.id },
    include: { points: { orderBy: { sortOrder: "asc" } } },
    orderBy: { name: "asc" }
  });
  const templates = await prisma.workflowTemplate.findMany({ include: { steps: { orderBy: { order: "asc" } } }, orderBy: { name: "asc" } });
  const qrCodes = await prisma.qrCode.findMany({ where: { entityType: "Aquarium", entityId: aquarium.id }, orderBy: { createdAt: "desc" }, take: 4 });

  const substrateItems = profileItems.filter((item) => item.itemType === "SUBSTRATE").map((item) => ({ id: item.id, label: item.name }));
  const lightItems = profileItems.filter((item) => item.equipmentProfile?.equipmentType === "LIGHT").map((item) => ({ id: item.id, label: item.name }));
  const locationOptions = locations.map((location) => ({ id: location.id, label: buildLocationPath(location) }));
  const livestock = aquarium.items.filter((item) => ["FISH", "INVERT"].includes(item.itemType));
  const plants = aquarium.items.filter((item) => item.itemType === "PLANT");
  const equipment = aquarium.items.filter((item) => item.itemType === "EQUIPMENT");
  const maintenanceEvents = aquarium.events.filter((event) => event.eventType === "MAINTENANCE" || event.eventType === "WATER_CHANGE");
  const latestByParameter = new Map<string, (typeof aquarium.readings)[number]>();
  for (const reading of aquarium.readings) {
    if (!latestByParameter.has(reading.parameter)) latestByParameter.set(reading.parameter, reading);
  }
  const assignment = aquarium.lightingAssignments[0] ?? null;
  const selectedSubstrate = substrateItems.find((item) => item.id === aquarium.profile?.substrateItemId)?.label ?? aquarium.profile?.substrate ?? null;
  const selectedLight = lightItems.find((item) => item.id === aquarium.profile?.lightItemId)?.label ?? assignment?.equipmentItem?.name ?? aquarium.profile?.lightingType ?? null;

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
        <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
          <Card>
            <CardHeader><CardTitle>Overview</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Info label="Location" value={aquarium.structuredLocation ? buildLocationPath(aquarium.structuredLocation) : aquarium.location} />
              <Info label="Started" value={aquarium.startedAt ? format(aquarium.startedAt, "MMM d, yyyy") : null} />
              <Info label="Dimensions" value={[aquarium.lengthInches, aquarium.widthInches, aquarium.heightInches].filter(Boolean).join(" x ") || null} />
              <Info label="Substrate" value={selectedSubstrate} />
              <Info label="Light" value={selectedLight} />
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
              <QuickAction href="#parameters" label="Log parameter" />
              <QuickAction href="#maintenance" label="Log maintenance" />
              <QuickAction href="#timeline" label="Add note" />
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

      <section className="grid gap-5 xl:grid-cols-2">
        <Card id="livestock" className="scroll-mt-20">
          <CardHeader><CardTitle>Livestock</CardTitle></CardHeader>
          <CardContent><ItemList items={livestock} emptyText="No livestock assigned to this aquarium yet." /></CardContent>
        </Card>
        <Card id="plants" className="scroll-mt-20">
          <CardHeader><CardTitle>Plants</CardTitle></CardHeader>
          <CardContent><ItemList items={plants} emptyText="No plants assigned to this aquarium yet." /></CardContent>
        </Card>
      </section>

      <section id="equipment" className="scroll-mt-20 grid gap-5 xl:grid-cols-[1fr_420px]">
        <Card>
          <CardHeader><CardTitle>Equipment</CardTitle></CardHeader>
          <CardContent><ItemList items={equipment} emptyText="No equipment assigned." showEquipment /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Lighting assignment</CardTitle></CardHeader>
          <CardContent>
            <form action={assignLightingSchedule} className="grid gap-3">
              <input type="hidden" name="aquariumId" value={aquarium.id} />
              <Select name="equipmentItemId" defaultValue={assignment?.equipmentItemId ?? aquarium.profile?.lightItemId ?? ""}>
                <option value="">No light assigned</option>
                {lightItems.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </Select>
              <Select name="scheduleId" defaultValue={assignment?.scheduleId ?? ""}>
                <option value="">No lighting schedule</option>
                {lightingSchedules.map((schedule) => <option key={schedule.id} value={schedule.id}>{schedule.name}</option>)}
              </Select>
              <Textarea name="lightingAssignmentNotes" placeholder="Lighting notes" defaultValue={assignment?.notes ?? ""} />
              <Button type="submit">Save lighting assignment</Button>
            </form>
            {assignment?.schedule ? <ScheduleSummary schedule={assignment.schedule} /> : null}
          </CardContent>
        </Card>
      </section>

      <section id="parameters" className="scroll-mt-20 grid gap-5 xl:grid-cols-[420px_1fr]">
        <Card>
          <CardHeader><CardTitle>Log parameters</CardTitle></CardHeader>
          <CardContent><ParameterBatchForm aquariumId={aquarium.id} /></CardContent>
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

      <section id="timeline" className="scroll-mt-20 grid gap-5 xl:grid-cols-[420px_1fr]">
        <Card>
          <CardHeader><CardTitle>Add timeline event</CardTitle></CardHeader>
          <CardContent><EventCreateForm aquariumId={aquarium.id} items={aquarium.items} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
          <CardContent><TimelineList events={aquarium.events} /></CardContent>
        </Card>
      </section>

      <section id="maintenance" className="scroll-mt-20 grid gap-5 xl:grid-cols-[420px_1fr]">
        <Card>
          <CardHeader><CardTitle>Log maintenance</CardTitle></CardHeader>
          <CardContent><MaintenanceForm aquariumId={aquarium.id} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Maintenance history</CardTitle></CardHeader>
          <CardContent><TimelineList events={maintenanceEvents} emptyText="No maintenance logged yet." /></CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Workflows</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <form action={startWorkflow} className="grid gap-3 md:grid-cols-[1fr_auto]">
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

      <section id="ai-studio" className="scroll-mt-20">
        <AiStudio aquarium={aquarium} />
      </section>

      <Card>
        <CardHeader><CardTitle>Edit tank profile</CardTitle></CardHeader>
        <CardContent><AquariumForm aquarium={aquarium} locations={locationOptions} substrateItems={substrateItems} lightItems={lightItems} /></CardContent>
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

function MaintenanceForm({ aquariumId }: { aquariumId: string }) {
  return (
    <form action={createMaintenanceEvent} className="grid gap-3">
      <input type="hidden" name="aquariumId" value={aquariumId} />
      <Select name="maintenanceType" defaultValue="WATER_CHANGE">
        {maintenanceTypes.map((type) => <option key={type}>{type}</option>)}
      </Select>
      <Input name="title" placeholder="Title, e.g. Weekly water change" />
      <Input name="eventDate" type="datetime-local" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Input name="waterChangePercent" type="number" step="1" placeholder="Water change percent" />
        <Input name="waterChangeGallons" type="number" step="0.5" placeholder="Water change gallons" />
      </div>
      <Input name="summary" placeholder="Summary" />
      <Textarea name="notes" placeholder="Maintenance notes" />
      <Button type="submit"><Wrench className="mr-2 h-4 w-4" />Log maintenance</Button>
    </form>
  );
}

function ScheduleSummary({ schedule }: { schedule: { name: string; points: { id: string; timeOfDay: string; white: number; red: number; green: number; blue: number; intensity: number | null }[] } }) {
  return (
    <div className="mt-4 rounded-md bg-muted/45 p-3">
      <div className="font-semibold text-primary">{schedule.name}</div>
      <div className="mt-2 grid gap-2">
        {schedule.points.map((point) => (
          <div key={point.id} className="flex items-center justify-between gap-3 text-xs">
            <span className="font-mono">{point.timeOfDay}</span>
            <span className="font-mono text-muted-foreground">W{point.white} R{point.red} G{point.green} B{point.blue}{point.intensity !== null ? ` · ${point.intensity}%` : ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
