import { format } from "date-fns";
import { EventTypeBadge } from "@/components/aquarium/EventTypeBadge";

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
};

export function TimelineItem({ event }: { event: TimelineEvent }) {
  return (
    <article className="relative grid gap-2 rounded-md border border-border bg-background/60 p-4">
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
