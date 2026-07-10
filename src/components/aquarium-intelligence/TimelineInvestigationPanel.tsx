import { TimelineInsightCard } from "@/components/aquarium-intelligence/TimelineInsightCard";

type Insight = Parameters<typeof TimelineInsightCard>[0]["insight"];

export function TimelineInvestigationPanel({ insights }: { insights: Insight[] }) {
  if (!insights.length) return <p className="text-sm text-muted-foreground">No timeline insights yet. Fluxpoint saves insights when there is enough temporal context to review.</p>;
  return <div className="grid gap-3 lg:grid-cols-2">{insights.map((insight) => <TimelineInsightCard key={insight.id} insight={insight} />)}</div>;
}
