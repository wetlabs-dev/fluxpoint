import { notFound } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { prisma } from "@/lib/db/prisma";
import { AquariumForm } from "@/components/aquarium/aquarium-form";
import { archiveAquarium } from "@/domains/aquariums/actions";
import { AiStudio } from "@/components/ai/ai-studio";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { completeWorkflowStep, createAquariumEvent, createReading, generateQrCode, startWorkflow } from "@/domains/management/actions";
import { formatReading } from "@/lib/format/readings";
import { buildLocationPath } from "@/lib/format/location";

export const dynamic = "force-dynamic";

const eventTypes = ["NOTE", "FEEDING", "WATER_CHANGE", "TEST_RESULT", "MAINTENANCE", "MEDICATION", "STOCKING", "DEATH", "PHOTO", "EQUIPMENT_CHANGE", "TRANSFER", "OTHER"];
const parameters = ["TEMPERATURE", "PH", "AMMONIA", "NITRITE", "NITRATE", "GH", "KH", "TDS", "TURBIDITY", "CO2", "LIGHT", "WATER_LEVEL", "OTHER"];

export default async function AquariumDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const { id } = await params;
  const aquarium = await prisma.aquarium.findFirst({
    where: { id, collectionId: collection.id },
    include: {
      profile: true,
      structuredLocation: { include: { parent: { include: { parent: true } } } },
      items: {
        include: { equipmentProfile: true, speciesDefinition: true },
        orderBy: { updatedAt: "desc" }
      },
      readings: { orderBy: { measuredAt: "desc" }, take: 24 },
      events: { orderBy: { eventDate: "desc" }, take: 20 },
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

  const equipment = aquarium.items.filter((item) => item.itemType === "EQUIPMENT");
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
  const substrateItems = profileItems.filter((item) => item.itemType === "SUBSTRATE").map((item) => ({ id: item.id, label: item.name }));
  const lightItems = profileItems.filter((item) => item.equipmentProfile?.equipmentType === "LIGHT").map((item) => ({ id: item.id, label: item.name }));
  const locationOptions = locations.map((location) => ({ id: location.id, label: buildLocationPath(location) }));
  const templates = await prisma.workflowTemplate.findMany({ include: { steps: { orderBy: { order: "asc" } } }, orderBy: { name: "asc" } });
  const qrCodes = await prisma.qrCode.findMany({ where: { entityType: "Aquarium", entityId: aquarium.id }, orderBy: { createdAt: "desc" }, take: 3 });

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
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Overview</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Info label="Location" value={aquarium.structuredLocation ? buildLocationPath(aquarium.structuredLocation) : aquarium.location} />
            <Info label="Dimensions" value={[aquarium.lengthInches, aquarium.widthInches, aquarium.heightInches].filter(Boolean).join(" x ") || null} />
            <Info label="Substrate" value={substrateItems.find((item) => item.id === aquarium.profile?.substrateItemId)?.label ?? aquarium.profile?.substrate} />
            <Info label="Lighting" value={lightItems.find((item) => item.id === aquarium.profile?.lightItemId)?.label ?? aquarium.profile?.lightingType} />
            <Info label="Filtration" value={aquarium.profile?.filtration} />
            <Info label="Water source" value={aquarium.profile?.waterSource} />
            <div className="md:col-span-2 text-sm text-muted-foreground">{aquarium.description ?? "No description yet."}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Edit basics</CardTitle></CardHeader>
          <CardContent><AquariumForm aquarium={aquarium} locations={locationOptions} substrateItems={substrateItems} lightItems={lightItems} /></CardContent>
        </Card>
      </div>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Items</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {aquarium.items.length ? aquarium.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-md border border-border bg-background/45 p-3">
                <div>
                  <div className="font-semibold">{item.name}</div>
                  <div className="text-sm text-muted-foreground">{item.itemType.toLowerCase()} · <span className="font-mono">qty {item.quantity} {item.unit ?? ""}</span></div>
                </div>
                <Badge>{item.status}</Badge>
              </div>
            )) : <p className="text-sm text-muted-foreground">No items recorded for this tank.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Equipment</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {equipment.length ? equipment.map((item) => (
              <div key={item.id} className="rounded-md border border-border bg-background/45 p-3">
                <div className="font-semibold">{item.name}</div>
                <div className="font-mono text-sm text-muted-foreground">{item.equipmentProfile?.brand ?? "Unbranded"} {item.equipmentProfile?.model ?? ""}</div>
              </div>
            )) : <p className="text-sm text-muted-foreground">No equipment assigned.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Parameters</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <form action={createReading} className="grid gap-3 md:grid-cols-4">
              <input type="hidden" name="aquariumId" value={aquarium.id} />
              <Select name="parameter" defaultValue="TEMPERATURE">{parameters.map((parameter) => <option key={parameter}>{parameter}</option>)}</Select>
              <Input name="value" type="number" step="0.01" placeholder="Value" required />
              <Input name="unit" placeholder="Unit" required />
              <Button type="submit">Add reading</Button>
            </form>
            <div className="grid gap-3 sm:grid-cols-2">
              {aquarium.readings.map((reading) => (
                <div key={reading.id} className="rounded-md bg-muted/55 p-3">
                  <div className="font-mono text-sm text-muted-foreground">{reading.parameter}</div>
                  <div className="font-mono text-xl font-semibold">{formatReading(reading.parameter, reading.value, reading.unit)}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Events</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <form action={createAquariumEvent} className="grid gap-3 md:grid-cols-2">
              <input type="hidden" name="aquariumId" value={aquarium.id} />
              <Select name="eventType" defaultValue="NOTE">{eventTypes.map((type) => <option key={type}>{type}</option>)}</Select>
              <Input name="title" placeholder="Title" required />
              <Input name="eventDate" type="datetime-local" />
              <Input name="summary" placeholder="Summary" />
              <Select name="parameter" defaultValue=""><option value="">Optional test parameter</option>{parameters.map((parameter) => <option key={parameter}>{parameter}</option>)}</Select>
              <Input name="value" type="number" step="0.01" placeholder="Test value" />
              <Input name="unit" placeholder="Test unit" />
              <Textarea className="md:col-span-2" name="notes" placeholder="Notes" />
              <Button className="md:col-span-2" type="submit">Add event</Button>
            </form>
            {aquarium.events.map((event) => (
              <div key={event.id} className="rounded-md border border-border bg-background/45 p-3">
                <div className="font-semibold">{event.title}</div>
                <div className="font-mono text-sm text-muted-foreground">{event.eventType} · {formatDistanceToNow(event.eventDate)} ago</div>
                {event.summary ? <p className="mt-1 text-sm">{event.summary}</p> : null}
              </div>
            ))}
          </CardContent>
        </Card>
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
        <Card>
          <CardHeader><CardTitle>QR labels</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <form action={generateQrCode}>
              <input type="hidden" name="entityType" value="Aquarium" />
              <input type="hidden" name="entityId" value={aquarium.id} />
              <input type="hidden" name="label" value={aquarium.generatedName ?? aquarium.name} />
              <Button type="submit">Generate tank QR</Button>
            </form>
            {qrCodes.map((qr) => (
              <div key={qr.id} className="rounded-md bg-muted/55 p-3">
                <div className="font-semibold">{qr.label}</div>
                <code className="break-all font-mono text-xs text-muted-foreground">{qr.payload}</code>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
      <AiStudio aquarium={aquarium} />
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="rounded-md bg-muted/55 p-3">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="font-semibold">{value || "Not set"}</div>
    </div>
  );
}
