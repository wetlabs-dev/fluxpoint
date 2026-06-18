import { TimelineItem } from "@/components/aquarium/TimelineItem";

type TimelineEvent = React.ComponentProps<typeof TimelineItem>["event"];

export function TimelineList({ events, emptyText = "No timeline entries yet." }: { events: TimelineEvent[]; emptyText?: string }) {
  if (!events.length) {
    return <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{emptyText}</div>;
  }

  return (
    <div className="space-y-3">
      {events.map((event) => <TimelineItem key={event.id} event={event} />)}
    </div>
  );
}
