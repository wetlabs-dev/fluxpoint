import Link from "next/link";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import type { EntityHistoryEntry } from "@/domains/history/entity-history";

export function EntityHistoryList({ entries }: { entries: EntityHistoryEntry[] }) {
  return <div className="space-y-3">{entries.length ? entries.map((entry) => <article key={entry.id} className="grid gap-3 rounded-md border border-border bg-background/55 p-4 sm:grid-cols-[8rem_minmax(0,1fr)]"><div className="font-mono text-xs text-muted-foreground">{format(entry.occurredAt, "MMM d, yyyy")}<span className="mt-1 block">{format(entry.occurredAt, "h:mm a")}</span></div><div><div className="flex flex-wrap items-start justify-between gap-2"><div className="font-semibold text-primary">{entry.url ? <Link className="hover:underline" href={entry.url}>{entry.title}</Link> : entry.title}</div><div className="flex flex-wrap gap-1"><Badge>{entry.sourceType.toLowerCase()}</Badge>{entry.severity ? <Badge>{entry.severity.toLowerCase()}</Badge> : null}{entry.status ? <Badge>{entry.status.toLowerCase().replaceAll("_", " ")}</Badge> : null}</div></div>{entry.summary ? <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{entry.summary}</p> : null}</div></article>) : <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No history entries yet.</p>}</div>;
}
