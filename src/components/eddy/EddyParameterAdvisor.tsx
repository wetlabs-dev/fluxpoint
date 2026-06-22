"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Clipboard, X } from "lucide-react";
import { applyParameterAdvisorRecommendations } from "@/domains/aquariums/parameter-advisor-actions";
import type { ParameterAdvisorDraft } from "@/domains/aquariums/parameter-advisor";
import type { EddyUsageStatus } from "@/domains/eddy/rate-limits";
import { EddyIcon } from "@/components/eddy/EddyIcon";
import { EddyLoadingState } from "@/components/eddy/EddyLoadingState";
import { EddyUsageNote } from "@/components/eddy/EddyUsageNote";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type AdvisorResponse = { draft: ParameterAdvisorDraft; requestLogId: string; usage: EddyUsageStatus };

export function EddyParameterAdvisor({ aquariumId, compact = false }: { aquariumId: string; compact?: boolean }) {
  const router = useRouter();
  const [result, setResult] = useState<AdvisorResponse | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function run() {
    setLoading(true); setError(null); setNotice(null); setResult(null); setSelected([]);
    const response = await fetch("/api/eddy/aquarium-parameter-advisor", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ aquariumId }) });
    const payload = await response.json();
    setLoading(false);
    if (!response.ok) return setError(payload.error || "Eddy could not review these parameters.");
    const safe = payload.draft.recommendations.filter((row: any) => row.status === "ADJUST" && row.safeToApply).map((row: any) => row.parameter);
    setSelected(safe); setResult(payload);
  }

  async function apply(parameters: string[]) {
    if (!result || !parameters.length) return;
    setApplying(true); setError(null); setNotice(null);
    try {
      const data = new FormData();
      data.set("aquariumId", aquariumId); data.set("requestLogId", result.requestLogId);
      parameters.forEach((parameter) => data.append("parameters", parameter));
      const applied = await applyParameterAdvisorRecommendations(data);
      setNotice(`Applied ${applied.changes.map((change) => `${label(change.parameter)}: ${change.before ?? "not set"} → ${change.after ?? "not set"}`).join("; ")}. Metric thresholds were recalculated.`);
      setSelected([]); router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The selected recommendations could not be applied.");
    } finally { setApplying(false); }
  }

  async function copySummary() {
    if (!result) return;
    const text = [result.draft.summary, ...result.draft.recommendations.map((row) => `${label(row.parameter)}: ${row.status} — ${row.reason}`)].join("\n");
    await navigator.clipboard.writeText(text);
    setNotice("Advisor summary copied.");
  }

  const panel = <>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-3xl">
        <div className="flex items-center gap-2"><EddyIcon size={28} alt="Eddy" /><h3 className="font-display text-2xl text-primary">Eddy Parameter Advisor</h3></div>
        <p className="mt-2 text-sm text-muted-foreground">Eddy’s parameter advice is based on your saved species profiles and stocking records. Verify sensitive changes and adjust water chemistry gradually.</p>
      </div>
      <Button type="button" onClick={run} disabled={loading || applying}><EddyIcon size={18} className="mr-2 h-[18px] w-[18px]" />Ask Eddy to Review Parameters</Button>
    </div>
    {loading ? <div className="mt-5"><EddyLoadingState message="Eddy is comparing target ranges with active stocking…" /></div> : null}
    {error ? <div className="mt-4 rounded-md border border-amber-500/45 bg-amber-500/10 p-3 text-sm">{error}</div> : null}
    {notice ? <div className="mt-4 rounded-md border border-emerald-500/45 bg-emerald-500/10 p-3 text-sm">{notice}</div> : null}
    {result ? <div className="mt-5 space-y-5">
      <div className="rounded-lg border border-border bg-muted/35 p-4">
        <div className="flex flex-wrap items-center gap-2"><Badge>{result.draft.overallFit.replaceAll("_", " ")}</Badge><Badge>{result.draft.confidence} confidence</Badge></div>
        <p className="mt-3 text-sm">{result.draft.summary}</p>
      </div>
      {result.draft.stockingConflicts.length ? <div className="rounded-lg border border-rose-500/45 bg-rose-500/10 p-4"><h4 className="font-semibold text-rose-800 dark:text-rose-200">Stocking conflicts need review</h4><ul className="mt-2 grid gap-1 text-sm">{result.draft.stockingConflicts.map((row, index) => <li key={`${row.species}-${row.parameter}-${index}`}><strong>{row.species}</strong> · {label(row.parameter)}: {row.issue}</li>)}</ul></div> : null}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-muted/55 text-xs uppercase tracking-[0.14em] text-muted-foreground"><tr><th className="p-3">Apply</th><th>Parameter</th><th>Current</th><th>Suggested</th><th>Status</th><th>Reason</th><th>Affected species</th></tr></thead>
          <tbody>{result.draft.recommendations.map((row) => {
            const eligible = row.status === "ADJUST" && row.safeToApply;
            return <tr key={row.parameter} className="border-t border-border align-top">
              <td className="p-3"><input aria-label={`Apply ${label(row.parameter)}`} type="checkbox" checked={selected.includes(row.parameter)} disabled={!eligible || applying} onChange={(event) => setSelected((current) => event.target.checked ? [...current, row.parameter] : current.filter((value) => value !== row.parameter))} /></td>
              <td className="py-3 font-semibold text-primary">{label(row.parameter)}</td>
              <td className="py-3 font-mono text-xs">{row.currentTarget ?? row.currentRange ?? "Not set"}{row.currentTarget && row.currentRange ? <span className="block text-muted-foreground">{row.currentRange}</span> : null}</td>
              <td className="py-3 font-mono text-xs">{row.suggestedTarget ?? row.suggestedRange ?? "No safe suggestion"}{row.suggestedTarget && row.suggestedRange ? <span className="block text-muted-foreground">{row.suggestedRange}</span> : null}</td>
              <td className="py-3"><StatusBadge status={row.status} /></td>
              <td className="max-w-sm py-3 pr-3"><span>{row.reason}</span>{row.cautions.length ? <ul className="mt-1 text-xs text-amber-700 dark:text-amber-200">{row.cautions.map((caution) => <li key={caution}>{caution}</li>)}</ul> : null}</td>
              <td className="max-w-xs py-3 pr-3 text-xs text-muted-foreground">{row.affectedSpecies.join(", ") || "No complete species data"}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => apply(selected)} disabled={!selected.length || applying}>{applying ? "Applying…" : `Apply selected (${selected.length})`}</Button>
        <Button type="button" variant="secondary" onClick={() => apply(result.draft.recommendations.filter((row) => row.status === "ADJUST" && row.safeToApply).map((row) => row.parameter))} disabled={!result.draft.recommendations.some((row) => row.status === "ADJUST" && row.safeToApply) || applying}><Check className="mr-2 h-4 w-4" />Apply all safe adjustments</Button>
        <Button type="button" variant="secondary" onClick={copySummary}><Clipboard className="mr-2 h-4 w-4" />Copy summary</Button>
        <Button type="button" variant="ghost" onClick={() => { setResult(null); setSelected([]); setNotice(null); }}><X className="mr-2 h-4 w-4" />Dismiss</Button>
      </div>
      {result.draft.missingData.length ? <details className="rounded-lg border border-border bg-muted/25 p-4"><summary className="cursor-pointer font-semibold">Missing saved data ({result.draft.missingData.length})</summary><ul className="mt-2 grid gap-1 text-sm text-muted-foreground">{result.draft.missingData.map((row) => <li key={row}>{row}</li>)}</ul></details> : null}
      <div className="rounded-lg border border-water/25 bg-water/10 p-4"><h4 className="font-semibold">Safe adjustment notes</h4><ul className="mt-2 grid gap-1 text-sm text-muted-foreground">{result.draft.safeAdjustmentNotes.map((row) => <li key={row}>{row}</li>)}</ul></div>
      <EddyUsageNote usage={result.usage} />
    </div> : null}
  </>;

  return compact ? <div className="rounded-xl border border-water/25 bg-water/5 p-4">{panel}</div> : <Card className="overflow-hidden border-water/25"><CardHeader className="bg-water/10"><CardTitle>Stocking-aware target review</CardTitle></CardHeader><CardContent className="pt-5">{panel}</CardContent></Card>;
}

function label(parameter: string) {
  return ({ temperature: "Temperature", ph: "pH", gh: "GH", kh: "KH", salinity: "Salinity", tds: "TDS", nitrate: "Nitrate", ammonia: "Ammonia", nitrite: "Nitrite" } as Record<string, string>)[parameter] ?? parameter;
}

function StatusBadge({ status }: { status: string }) {
  const text = status === "INSUFFICIENT_DATA" ? "Missing data" : status.charAt(0) + status.slice(1).toLowerCase();
  return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${status === "KEEP" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-200" : status === "ADJUST" ? "bg-amber-500/15 text-amber-800 dark:text-amber-200" : status === "CONFLICT" ? "bg-rose-500/15 text-rose-800 dark:text-rose-200" : "bg-muted text-muted-foreground"}`}>{text}</span>;
}
