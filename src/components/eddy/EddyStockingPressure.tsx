"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EddyIcon } from "@/components/eddy/EddyIcon";
import { EddyLoadingState } from "@/components/eddy/EddyLoadingState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { stockingPressureConfidenceLabels, stockingPressureFlagDescriptions, stockingPressureFlagLabels, stockingPressureLevelLabels, type StockingPressureFlag } from "@/domains/aquariums/stocking-pressure-flags";

export type StockingPressureView = {
  id: string;
  level: keyof typeof stockingPressureLevelLabels;
  confidence: keyof typeof stockingPressureConfidenceLabels;
  flags: StockingPressureFlag[];
  summary: string;
  reasoning: string[];
  cautions: string[];
  missingData: string[];
  estimatedAt: string;
};

export function EddyStockingPressure({ aquariumId, initialEstimate, initialEligible, initialStale }: { aquariumId: string; initialEstimate: StockingPressureView | null; initialEligible: boolean; initialStale: boolean }) {
  const router = useRouter();
  const [estimate, setEstimate] = useState(initialEstimate);
  const [eligible, setEligible] = useState(initialEligible);
  const [stale, setStale] = useState(initialStale);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function estimatePressure() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/eddy/aquarium-stocking-pressure", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ aquariumId }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Eddy could not estimate stocking pressure.");
      setEstimate(payload.estimate);
      setEligible(false);
      setStale(false);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Eddy could not estimate stocking pressure.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="overflow-hidden border-water/25" data-testid="stocking-pressure-card">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2"><EddyIcon size={22} /> Stocking Pressure</CardTitle>
          {estimate ? <PressureBadge level={estimate.level} /> : <Badge>Unknown</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {estimate ? <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{stockingPressureConfidenceLabels[estimate.confidence]} confidence</Badge>
            {estimate.flags.map((flag) => <span key={flag} className="inline-flex rounded-full border border-water/25 bg-water/10 px-2 py-1 text-xs font-semibold text-primary" title={stockingPressureFlagDescriptions[flag]}>{stockingPressureFlagLabels[flag]}</span>)}
          </div>
          <div>
            <p className="font-semibold text-primary">{subtitle(estimate.level)}</p>
            <p className="mt-1 text-sm text-muted-foreground">{estimate.summary}</p>
            <p className="mt-2 text-sm">{estimate.reasoning.slice(0, 3).join(" ")}</p>
          </div>
          {estimate.missingData.length ? <p className="rounded-md bg-muted/55 p-2 text-xs text-muted-foreground">Add species sizes, quantities, and filter details to improve confidence. {estimate.missingData[0]}</p> : null}
          <p className="text-xs text-muted-foreground">{confidenceCopy(estimate.confidence)}</p>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
            <div className="text-xs text-muted-foreground">
              <div>Last estimated {formatUtc(estimate.estimatedAt)}</div>
              {stale ? <div className="font-semibold text-amber-700 dark:text-amber-300">Stocking, filtration, or volume changed since this estimate.</div> : <div>Estimate is current for saved tank inputs.</div>}
            </div>
            {eligible ? <Button type="button" className="min-h-9 py-1.5" onClick={estimatePressure} disabled={loading}>Refresh with Eddy</Button> : <span className="max-w-xs text-right text-xs text-muted-foreground">Refresh available after stocking, filtration, or volume changes.</span>}
          </div>
          <p className="text-xs text-muted-foreground">{estimate.cautions[0]}</p>
        </> : <>
          <p className="text-sm text-muted-foreground">No stocking pressure estimate yet.</p>
          <p className="text-xs text-muted-foreground">Eddy uses saved volume, active inhabitants, plants, and attached filtration. The result is qualitative and only updates when you request it.</p>
          {eligible ? <Button type="button" className="min-h-9 py-1.5" onClick={estimatePressure} disabled={loading}>Estimate with Eddy</Button> : null}
        </>}
        {loading ? <EddyLoadingState message="Eddy is reviewing saved stocking, plants, and filtration…" /> : null}
        {error ? <p role="alert" className="rounded-md border border-amber-500/45 bg-amber-500/10 p-3 text-sm">{error}</p> : null}
      </CardContent>
    </Card>
  );
}

function PressureBadge({ level }: { level: keyof typeof stockingPressureLevelLabels }) {
  const tone = level === "OVERSTOCKED" ? "bg-rose-500/15 text-rose-800 dark:text-rose-200" : level === "HEAVY" ? "bg-amber-500/20 text-amber-900 dark:text-amber-200" : level === "MODERATE" ? "bg-sky-500/15 text-sky-800 dark:text-sky-200" : level === "UNKNOWN" ? "bg-muted text-muted-foreground" : "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200";
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>{stockingPressureLevelLabels[level]}</span>;
}

function subtitle(level: keyof typeof stockingPressureLevelLabels) {
  if (level === "VERY_LIGHT" || level === "LIGHT") return "Lightly stocked";
  if (level === "MODERATE") return "Moderately stocked";
  if (level === "HEAVY") return "Heavily stocked for current filtration";
  if (level === "OVERSTOCKED") return "Overstock risk needs review";
  return "Insufficient saved data";
}

function confidenceCopy(confidence: keyof typeof stockingPressureConfidenceLabels) {
  if (confidence === "HIGH") return "Estimate based on detailed stocking, plant, and filtration records.";
  if (confidence === "MEDIUM") return "Estimate based on known stocking and partial equipment or species data.";
  return "Estimate based on partial stocking or equipment data.";
}

function formatUtc(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })} UTC`;
}
