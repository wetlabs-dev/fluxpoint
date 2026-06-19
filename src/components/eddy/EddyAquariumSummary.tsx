"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EddyIcon } from "@/components/eddy/EddyIcon";
import { EddyEmptyState } from "@/components/eddy/EddyEmptyState";
import { EddyLoadingState } from "@/components/eddy/EddyLoadingState";
import { EddyMessageCard } from "@/components/eddy/EddyMessageCard";
import { EddyCompatibilityForm } from "@/components/eddy/EddyCompatibilityForm";
import { EddyStockingForm } from "@/components/eddy/EddyStockingForm";
import { EddyCareRecommendationPanel } from "@/components/eddy/EddyCareRecommendationPanel";
import { EddyIdentityGenerator } from "@/components/eddy/EddyIdentityGenerator";
import type { EddyAction, EddyResult } from "@/domains/eddy/eddy-types";
import type { EddyUsageStatus } from "@/domains/eddy/rate-limits";
import { EddyUsageNote } from "@/components/eddy/EddyUsageNote";

const tools: Array<{ action: EddyAction; label: string }> = [
  { action: "tank-summary", label: "Tank summary" },
  { action: "compatibility", label: "Compatibility" },
  { action: "stocking-suggestions", label: "Stocking" },
  { action: "care-recommendations", label: "Care" },
  { action: "name-ideas", label: "Identity" },
  { action: "troubleshooting", label: "Troubleshooting" }
];

export function EddyAquariumSummary({ aquariumId, provider, fallbackActive, imageEnabled, initialImageUsage }: { aquariumId: string; provider: string; fallbackActive?: boolean; imageEnabled?: boolean; initialImageUsage?: EddyUsageStatus | null }) {
  const router = useRouter();
  const [active, setActive] = useState<EddyAction>("tank-summary");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EddyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<EddyUsageStatus | null>(null);
  const [usageAction, setUsageAction] = useState<EddyAction | null>(null);
  const [imageUsage, setImageUsage] = useState<EddyUsageStatus | null>(initialImageUsage ?? null);
  const [imageLoading, setImageLoading] = useState(false);
  async function run(action: EddyAction, input: Record<string, unknown> = {}) {
    setActive(action); setLoading(true); setError(null); setResult(null); setUsage(null); setUsageAction(action);
    const response = await fetch(`/api/eddy/${action}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ aquariumId, input }) });
    const payload = await response.json(); setLoading(false);
    if (!response.ok) { setUsage(payload.rateLimit ?? null); return setError(payload.error || "Eddy could not complete that request."); }
    setUsage(payload.usage ?? null); setResult(payload);
  }
  async function generateImage() {
    setImageLoading(true); setError(null);
    const response = await fetch("/api/eddy/cover-image-generation", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ aquariumId }) });
    const payload = await response.json(); setImageLoading(false);
    if (!response.ok) { setImageUsage(payload.rateLimit ?? imageUsage); return setError(payload.error || "Eddy could not generate a cover image right now."); }
    setImageUsage(payload.usage ?? imageUsage); setResult({ title: "Cover image generated", summary: "Eddy created and assigned a new moderated cover image for this aquarium.", observations: [], recommendations: ["Review the cover in the aquarium header and regenerate only if the concept needs a meaningful change."], assumptions: [], basedOn: [{ label: "Aquarium identity", detail: "Tank profile, inhabitants, plants, hardscape, and recorded mood" }] }); router.refresh();
  }
  const actionBlocked = usageAction === active && usage?.allowed === false;
  return <Card className="overflow-hidden border-water/25">
    <CardHeader className="bg-water/10"><CardTitle className="flex items-center gap-3"><span className="rounded-lg bg-white/80 p-1.5 dark:bg-white/90"><EddyIcon size={40} className="h-10 w-10" /></span><span><span className="block font-display text-3xl font-normal">Eddy Studio</span><span className="block text-sm font-normal text-muted-foreground">Tank-aware help through the {provider}{fallbackActive ? " fallback" : ""} provider</span></span></CardTitle></CardHeader>
    <CardContent className="space-y-5 pt-5">
      <div className="flex gap-2 overflow-x-auto pb-1">{tools.map((tool) => <Button key={tool.action} type="button" variant={active === tool.action ? "primary" : "secondary"} className="shrink-0" onClick={() => { setActive(tool.action); setResult(null); setError(null); }}>{tool.label}</Button>)}</div>
      <div className="rounded-xl border border-border bg-background/45 p-4">{active === "tank-summary" ? <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Review profile, inhabitants, equipment, lighting, readings, timeline, tasks, husbandry, quarantine, and active medication records.</p><Button onClick={() => run("tank-summary")} disabled={loading || actionBlocked}><EddyIcon size={18} className="mr-2 h-[18px] w-[18px]" />Summarize tank</Button></div> : null}{active === "compatibility" ? <EddyCompatibilityForm onRun={(input) => run("compatibility", input)} loading={loading || actionBlocked} /> : null}{active === "stocking-suggestions" ? <EddyStockingForm onRun={(input) => run("stocking-suggestions", input)} loading={loading || actionBlocked} /> : null}{active === "care-recommendations" ? <EddyCareRecommendationPanel onRun={(input) => run("care-recommendations", input)} loading={loading || actionBlocked} /> : null}{active === "name-ideas" || active === "cover-concepts" ? <div className="space-y-3"><EddyIdentityGenerator imageEnabled={imageEnabled} imageUsage={imageUsage} onGenerateImage={generateImage} onRun={run} loading={loading || actionBlocked} imageLoading={imageLoading} /><p className="text-xs text-muted-foreground">Concepts include names, subtitles, palettes, motifs, and a cover prompt. {imageEnabled ? "OpenAI image generation is available from the moderated cover workflow." : "Image generation is currently disabled or not configured."}</p></div> : null}{active === "troubleshooting" ? <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Eddy asks for useful missing evidence without pretending to diagnose disease.</p><Button onClick={() => run("troubleshooting")} disabled={loading || actionBlocked}><EddyIcon size={18} className="mr-2 h-[18px] w-[18px]" />Start questions</Button></div> : null}</div>
      {loading ? <EddyLoadingState /> : result ? <EddyMessageCard result={result} /> : <EddyEmptyState />}{error ? <div className="rounded-lg border border-amber-400/35 bg-amber-400/10 p-3 text-sm">{error}</div> : null}<EddyUsageNote usage={usage} />
    </CardContent>
  </Card>;
}
