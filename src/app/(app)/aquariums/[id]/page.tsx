import { notFound } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { prisma } from "@/lib/db/prisma";
import { AquariumForm } from "@/components/aquarium/aquarium-form";
import { AiStudio } from "@/components/ai/ai-studio";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AquariumDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const aquarium = await prisma.aquarium.findUnique({
    where: { id },
    include: {
      profile: true,
      items: {
        include: { equipmentProfile: true, speciesDefinition: true },
        orderBy: { updatedAt: "desc" }
      },
      readings: { orderBy: { measuredAt: "desc" }, take: 12 },
      events: { orderBy: { eventDate: "desc" }, take: 10 },
      workflowRuns: { include: { workflowTemplate: true }, orderBy: { startedAt: "desc" } },
      aiSuggestions: { orderBy: { createdAt: "desc" }, take: 8 }
    }
  });

  if (!aquarium) notFound();

  const equipment = aquarium.items.filter((item) => item.itemType === "EQUIPMENT");

  return (
    <div className="space-y-6">
      <PageHeader title={aquarium.generatedName ?? aquarium.name} eyebrow={aquarium.name}>
        <div className="flex flex-wrap gap-2">
          <Badge>{aquarium.tankType}</Badge>
          <Badge>{aquarium.status}</Badge>
          <Badge>{aquarium.volumeGallons ?? "?"} gallons</Badge>
        </div>
      </PageHeader>
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Overview</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Info label="Location" value={aquarium.location} />
            <Info label="Dimensions" value={[aquarium.lengthInches, aquarium.widthInches, aquarium.heightInches].filter(Boolean).join(" x ") || null} />
            <Info label="Substrate" value={aquarium.profile?.substrate} />
            <Info label="Lighting" value={aquarium.profile?.lightingType} />
            <div className="md:col-span-2 text-sm text-muted-foreground">{aquarium.description ?? "No description yet."}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Edit basics</CardTitle></CardHeader>
          <CardContent><AquariumForm aquarium={aquarium} /></CardContent>
        </Card>
      </div>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Stocking and items</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {aquarium.items.length ? aquarium.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-md border border-border bg-white/55 p-3">
                <div>
                  <div className="font-semibold">{item.name}</div>
                  <div className="text-sm text-muted-foreground">{item.itemType.toLowerCase()} · qty {item.quantity} {item.unit ?? ""}</div>
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
              <div key={item.id} className="rounded-md border border-border bg-white/55 p-3">
                <div className="font-semibold">{item.name}</div>
                <div className="text-sm text-muted-foreground">{item.equipmentProfile?.brand ?? "Unbranded"} {item.equipmentProfile?.model ?? ""}</div>
              </div>
            )) : <p className="text-sm text-muted-foreground">No equipment assigned.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Parameters</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {aquarium.readings.map((reading) => (
              <div key={reading.id} className="rounded-md bg-muted/55 p-3">
                <div className="text-sm text-muted-foreground">{reading.parameter}</div>
                <div className="text-xl font-semibold">{reading.value} {reading.unit}</div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Events and log</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {aquarium.events.map((event) => (
              <div key={event.id} className="rounded-md border border-border bg-white/55 p-3">
                <div className="font-semibold">{event.title}</div>
                <div className="text-sm text-muted-foreground">{event.eventType} · {formatDistanceToNow(event.eventDate)} ago</div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Workflows</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {aquarium.workflowRuns.length ? aquarium.workflowRuns.map((run) => (
              <div key={run.id} className="rounded-md border border-border bg-white/55 p-3">
                <div className="font-semibold">{run.workflowTemplate.name}</div>
                <div className="text-sm text-muted-foreground">{run.status}</div>
              </div>
            )) : <p className="text-sm text-muted-foreground">No active workflows for this tank.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Recent AI selections</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {aquarium.aiSuggestions.length ? aquarium.aiSuggestions.map((suggestion) => (
              <div key={suggestion.id} className="rounded-md border border-border bg-white/55 p-3">
                <div className="font-semibold">{suggestion.suggestionType}</div>
                <div className="text-sm text-muted-foreground">{suggestion.selected ? "Selected" : "Draft"} · {formatDistanceToNow(suggestion.createdAt)} ago</div>
              </div>
            )) : <p className="text-sm text-muted-foreground">No AI suggestions selected yet.</p>}
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
