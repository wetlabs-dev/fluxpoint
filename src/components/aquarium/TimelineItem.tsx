import { format } from "date-fns";
import { EventTypeBadge } from "@/components/aquarium/EventTypeBadge";
import { MediaThumbnail } from "@/components/media/MediaThumbnail";

type TimelineEvent = {
  id: string;
  eventType: string;
  title: string;
  summary: string | null;
  notes: string | null;
  eventDate: Date;
  maintenanceType?: string | null;
  waterChangePercent?: number | null;
  waterChangeGallons?: number | null;
  createdBy?: { name: string } | null;
  relatedItem?: { name: string; itemType: string } | null;
  relatedSpecies?: { commonName: string; scientificName: string | null } | null;
  waterChangeEvent?: { volumeGallons: number | null; percentChanged: number | null; waterSource: string | null; conditionerUsed: string | null; temperatureMatched: boolean | null } | null;
  feedingEvent?: { foodNameSnapshot: string | null; amount: string | null; target: string | null; foodItem?: { name: string } | null } | null;
  maintenanceEvent?: { maintenanceType: string; summary: string | null; equipmentItem?: { name: string; equipmentProfile?: { equipmentType: string } | null } | null } | null;
  medicationDoseEvent?: { doseAmount: number | null; doseUnit: string | null; recommendedDoseAmount?: number | null; recommendedDoseUnit?: string | null; doseType?: string; doseNumber: number | null; medicationCourse: { title: string; medicationDefinition: { name: string } } } | null;
  relatedMedicationCourse?: { title: string; calculatedDoseAmount: number | null; calculatedDoseUnit: string | null; medicationDefinition: { name: string } } | null;
  readings?: { id: string; parameter: string; value: number; unit: string }[];
  mediaAssets?: { id: string; url: string; thumbnailUrl: string | null; caption: string | null; altText: string | null; moderationStatus: "PENDING" | "APPROVED" | "FLAGGED" | "REJECTED" | "ERROR"; hiddenAt: Date | null; createdAt: Date }[];
};

export function TimelineItem({ event }: { event: TimelineEvent }) {
  return (
    <article id={`event-${event.id}`} data-event-type={event.eventType} className="relative grid scroll-mt-20 gap-2 rounded-md border border-border bg-background/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <EventTypeBadge type={event.eventType} />
          <time className="font-mono text-xs text-muted-foreground">{format(event.eventDate, "MMM d, yyyy h:mm a")}</time>
        </div>
        <span className="text-xs text-muted-foreground">{event.createdBy?.name ?? "Unknown keeper"}</span>
      </div>
      <div>
        <h3 className="font-semibold text-primary">{event.title}</h3>
        {event.relatedItem ? (
          <p className="text-xs text-muted-foreground">{event.relatedItem.name} · {event.relatedItem.itemType.toLowerCase()}</p>
        ) : null}
      </div>
      {event.summary ? <p className="text-sm text-muted-foreground">{event.summary}</p> : null}
      <StructuredDetails event={event} />
      {event.mediaAssets?.some((asset) => asset.moderationStatus === "APPROVED" && !asset.hiddenAt) ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {event.mediaAssets.filter((asset) => asset.moderationStatus === "APPROVED" && !asset.hiddenAt).map((asset) => <MediaThumbnail key={asset.id} asset={asset} className="aspect-video w-full" />)}
        </div>
      ) : null}
      {event.maintenanceType || event.waterChangePercent || event.waterChangeGallons ? (
        <div className="flex flex-wrap gap-2 text-xs">
          {event.maintenanceType ? <span className="rounded-full bg-muted px-2.5 py-1 font-semibold">{event.maintenanceType.replaceAll("_", " ").toLowerCase()}</span> : null}
          {event.waterChangePercent ? <span className="rounded-full bg-muted px-2.5 py-1 font-mono">{event.waterChangePercent}% change</span> : null}
          {event.waterChangeGallons ? <span className="rounded-full bg-muted px-2.5 py-1 font-mono">{event.waterChangeGallons} gal</span> : null}
        </div>
      ) : null}
      {event.notes ? <p className="whitespace-pre-wrap text-sm">{event.notes}</p> : null}
    </article>
  );
}

function StructuredDetails({ event }: { event: TimelineEvent }) {
  const chips = [
    event.waterChangeEvent?.volumeGallons !== null && event.waterChangeEvent?.volumeGallons !== undefined ? `${event.waterChangeEvent.volumeGallons} gal changed` : null,
    event.waterChangeEvent?.percentChanged !== null && event.waterChangeEvent?.percentChanged !== undefined ? `${event.waterChangeEvent.percentChanged}% changed` : null,
    event.waterChangeEvent?.waterSource ? `source ${event.waterChangeEvent.waterSource}` : null,
    event.waterChangeEvent?.conditionerUsed ? `conditioner ${event.waterChangeEvent.conditionerUsed}` : null,
    event.waterChangeEvent?.temperatureMatched ? "temperature matched" : null,
    event.feedingEvent?.foodItem?.name ?? event.feedingEvent?.foodNameSnapshot ?? null,
    event.feedingEvent?.amount ? `amount ${event.feedingEvent.amount}` : null,
    event.feedingEvent?.target ? `target ${event.feedingEvent.target}` : null,
    event.maintenanceEvent?.equipmentItem ? `${event.maintenanceEvent.equipmentItem.name} · ${event.maintenanceEvent.equipmentItem.equipmentProfile?.equipmentType ?? "equipment"}` : null,
    event.medicationDoseEvent ? `${event.medicationDoseEvent.medicationCourse.medicationDefinition.name} dose ${event.medicationDoseEvent.doseNumber ?? ""}`.trim() : null,
    event.medicationDoseEvent?.doseType ? event.medicationDoseEvent.doseType.replaceAll("_", " ").toLowerCase() : null,
    event.medicationDoseEvent?.recommendedDoseAmount !== null && event.medicationDoseEvent?.recommendedDoseAmount !== undefined ? `recommended ${event.medicationDoseEvent.recommendedDoseAmount}${event.medicationDoseEvent.recommendedDoseUnit ?? ""}` : null,
    event.medicationDoseEvent?.doseAmount !== null && event.medicationDoseEvent?.doseAmount !== undefined ? `${event.medicationDoseEvent.doseAmount}${event.medicationDoseEvent.doseUnit ?? ""}` : null,
    event.relatedMedicationCourse ? `${event.relatedMedicationCourse.medicationDefinition.name} course` : null,
    event.relatedMedicationCourse?.calculatedDoseAmount !== null && event.relatedMedicationCourse?.calculatedDoseAmount !== undefined ? `${Number(event.relatedMedicationCourse.calculatedDoseAmount.toFixed(2))}${event.relatedMedicationCourse.calculatedDoseUnit ?? ""}` : null
  ].filter(Boolean);

  return (
    <div className="space-y-2">
      {chips.length ? (
        <div className="flex flex-wrap gap-2 text-xs">
          {chips.map((chip) => <span key={chip} className="rounded-full bg-muted px-2.5 py-1 font-mono text-muted-foreground">{chip}</span>)}
        </div>
      ) : null}
      {event.readings?.length ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {event.readings.map((reading) => (
            <div key={reading.id} className="rounded-md bg-muted/55 p-2">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{reading.parameter}</div>
              <div className="font-mono font-semibold text-primary">{reading.value}{reading.unit}</div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
