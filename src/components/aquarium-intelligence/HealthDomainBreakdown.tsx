import { HealthFactorList } from "@/components/aquarium-intelligence/HealthFactorList";

type Domain = { key?: string; label?: string; state?: string; confidence?: string; evidence?: string[]; favorableFactors?: unknown[]; adverseFactors?: unknown[]; missingData?: string[]; recommendedReviewItems?: string[] };

export function HealthDomainBreakdown({ domains }: { domains: Domain[] }) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {domains.map((domain) => (
        <div key={domain.key ?? domain.label} className="rounded-md border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-primary">{domain.label ?? domain.key}</h3>
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{formatState(domain.state)} · {formatState(domain.confidence)} confidence</p>
            </div>
            <span className={`rounded-md px-2 py-1 text-xs font-semibold ${stateClass(domain.state)}`}>{formatState(domain.state)}</span>
          </div>
          {domain.evidence?.length ? <p className="mt-3 text-sm text-muted-foreground">{domain.evidence.join(" ")}</p> : null}
          <div className="mt-3 grid gap-3">
            <HealthFactorList factors={(domain.adverseFactors ?? []) as never[]} emptyText="No attention factors in this domain." />
            {domain.missingData?.length ? <p className="text-xs text-muted-foreground">Missing: {domain.missingData.join(", ")}</p> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export function formatState(value?: string | null) {
  return value ? value.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase()) : "Unknown";
}

export function stateClass(state?: string | null) {
  if (state === "CRITICAL") return "bg-destructive/15 text-destructive";
  if (state === "CONCERN") return "bg-amber-100 text-amber-950 dark:bg-amber-950/45 dark:text-amber-100";
  if (state === "WATCH") return "bg-sky-100 text-sky-950 dark:bg-sky-950/45 dark:text-sky-100";
  if (state === "INSUFFICIENT_DATA") return "bg-muted text-muted-foreground";
  return "bg-emerald-100 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100";
}
