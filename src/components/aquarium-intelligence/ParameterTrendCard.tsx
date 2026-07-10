import { format } from "date-fns";
import { formatApprox } from "@/domains/aquarium-intelligence/serializers";
import { formatState, stateClass } from "@/components/aquarium-intelligence/HealthDomainBreakdown";

type Analysis = { metricKey: string; unit: string; currentValue: number | null; trendState: string; stabilityState: string; concernState: string; observationCount: number; sourceType: string; analysisWindowStart: Date; analysisWindowEnd: Date; interpretation: string };

export function ParameterTrendCard({ analysis }: { analysis: Analysis }) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-primary">{label(analysis.metricKey)}</h3>
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{analysis.observationCount} observations · {analysis.sourceType.toLowerCase()}</p>
        </div>
        <span className={`rounded-md px-2 py-1 text-xs font-semibold ${stateClass(analysis.concernState === "NORMAL" ? "GOOD" : analysis.concernState)}`}>{formatState(analysis.concernState)}</span>
      </div>
      <div className="mt-3 text-2xl font-semibold">{formatApprox(analysis.currentValue)} <span className="text-sm font-normal text-muted-foreground">{analysis.unit}</span></div>
      <div className="mt-2 text-sm text-muted-foreground">{formatState(analysis.trendState)} · {formatState(analysis.stabilityState)} · {format(analysis.analysisWindowStart, "MMM d")} to {format(analysis.analysisWindowEnd, "MMM d")}</div>
      <p className="mt-3 text-sm">{analysis.interpretation}</p>
    </div>
  );
}

function label(metricKey: string) {
  return metricKey.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}
