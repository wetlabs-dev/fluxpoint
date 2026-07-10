import { format } from "date-fns";
import { dismissTimelineInsight } from "@/domains/aquarium-intelligence/actions";
import { Button } from "@/components/ui/button";
import { formatState } from "@/components/aquarium-intelligence/HealthDomainBreakdown";

type Insight = { id: string; title: string; summary: string; confidence: string; evidence: unknown; caveats: unknown; createdAt: Date };

export function TimelineInsightCard({ insight }: { insight: Insight }) {
  const evidence = Array.isArray(insight.evidence) ? insight.evidence as Array<{ occurredAt?: string; title?: string; source?: string }> : [];
  const caveats = Array.isArray(insight.caveats) ? insight.caveats as string[] : [];
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-primary">{insight.title}</h3>
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{formatState(insight.confidence)} confidence · {format(insight.createdAt, "MMM d")}</p>
        </div>
        <form action={dismissTimelineInsight}>
          <input type="hidden" name="insightId" value={insight.id} />
          <Button type="submit" variant="ghost">Dismiss</Button>
        </form>
      </div>
      <p className="mt-3 text-sm">{insight.summary}</p>
      {evidence.length ? (
        <div className="mt-3 space-y-2">
          {evidence.slice(0, 4).map((item, index) => (
            <div key={`${item.title}-${index}`} className="rounded-md bg-muted/45 p-2 text-sm">
              <span className="font-semibold">{item.occurredAt ? format(new Date(item.occurredAt), "MMM d") : "Date unknown"}</span> · {item.title} <span className="text-muted-foreground">({item.source})</span>
            </div>
          ))}
        </div>
      ) : null}
      {caveats.length ? <p className="mt-3 text-xs text-muted-foreground">{caveats[0]}</p> : null}
    </div>
  );
}
