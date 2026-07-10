import { format } from "date-fns";

type Factor = { severity?: string; explanation?: string; source?: string; occurredAt?: string };

export function HealthFactorList({ factors, emptyText = "No factors recorded." }: { factors: Factor[]; emptyText?: string }) {
  if (!factors.length) return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  return (
    <div className="space-y-2">
      {factors.map((factor, index) => (
        <div key={`${factor.explanation}-${index}`} className="rounded-md border border-border bg-background/60 p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <span>{factor.severity?.replaceAll("_", " ").toLowerCase() ?? "factor"}</span>
            {factor.source ? <span>· {factor.source}</span> : null}
            {factor.occurredAt ? <span>· {format(new Date(factor.occurredAt), "MMM d")}</span> : null}
          </div>
          <p className="mt-1 text-sm">{factor.explanation}</p>
        </div>
      ))}
    </div>
  );
}
