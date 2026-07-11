"use client";

import { useEffect, useState } from "react";
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

export function EddyAquariumSummary({ aquariumId, aquariumName, provider, fallbackActive, imageEnabled, initialImageUsage }: { aquariumId: string; aquariumName: string; provider: string; fallbackActive?: boolean; imageEnabled?: boolean; initialImageUsage?: EddyUsageStatus | null }) {
  const router = useRouter();
  const [active, setActive] = useState<EddyAction>("tank-summary");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EddyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<EddyUsageStatus | null>(null);
  const [usageAction, setUsageAction] = useState<EddyAction | null>(null);
  const [imageUsage, setImageUsage] = useState<EddyUsageStatus | null>(initialImageUsage ?? null);
  const [imageLoading, setImageLoading] = useState(false);
  const [coverConcepts, setCoverConcepts] = useState<NonNullable<EddyResult["suggestions"]>>([]);
  const [selectedConceptId, setSelectedConceptId] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [imageJob, setImageJob] = useState<any>(null);
  useEffect(() => {
    if (!imageJob?.id || !["PENDING", "CLAIMED", "RUNNING"].includes(imageJob.status)) return;
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/ai-jobs/${imageJob.id}`, { cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json(); setImageJob(payload.job);
      if (payload.job.status === "COMPLETED") { setImageLoading(false); setResult({ title: "Cover image complete", summary: payload.job.result?.assignedAsCover ? "Eddy created, moderated, and assigned the aquarium cover." : "Eddy created the image, but kept your newer cover selection unchanged.", observations: [], recommendations: [], assumptions: [], basedOn: [] }); router.refresh(); }
      if (["FAILED", "DEAD_LETTER", "CANCELLED"].includes(payload.job.status)) { setImageLoading(false); setError(payload.job.error || `Cover job ${payload.job.status.toLowerCase()}.`); }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [imageJob?.id, imageJob?.status, router]);
  async function run(action: EddyAction, input: Record<string, unknown> = {}) {
    setActive(action); setLoading(true); setError(null); setResult(null); setUsage(null); setUsageAction(action);
    const response = await fetch(`/api/eddy/${action}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ aquariumId, input }) });
    const payload = await response.json(); setLoading(false);
    if (!response.ok) { setUsage(payload.rateLimit ?? null); return setError(payload.error || "Eddy could not complete that request."); }
    if (action === "cover-concepts") {
      const suggestions = Array.isArray(payload.suggestions) ? payload.suggestions : [];
      setCoverConcepts(suggestions);
      setSelectedConceptId(suggestions[0]?.id || suggestions[0]?.title || suggestions[0]?.name || (suggestions.length ? "concept-0" : null));
    }
    setUsage(payload.usage ?? null); setResult(payload);
  }
  async function generateImage() {
    setImageLoading(true); setError(null);
    const selectedConcept = coverConcepts.find((concept, index) => (concept.id || concept.title || concept.name || `concept-${index}`) === selectedConceptId) ?? coverConcepts[0] ?? null;
    const useCustomPrompt = customPrompt.trim().length > 0;
    const response = await fetch("/api/eddy/cover-image-generation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        aquariumId,
        input: {
          selectedConceptId: useCustomPrompt ? null : selectedConcept?.id || selectedConceptId,
          selectedConceptTitle: useCustomPrompt ? null : selectedConcept?.title || selectedConcept?.name,
          selectedConceptDescription: useCustomPrompt ? null : selectedConcept?.description || selectedConcept?.detail,
          selectedConceptPrompt: useCustomPrompt ? null : selectedConcept?.generationPrompt || selectedConcept?.promptDraft || selectedConcept?.promptText || selectedConcept?.detail,
          selectedConceptTags: useCustomPrompt ? [] : selectedConcept?.tags ?? [],
          customPrompt: useCustomPrompt ? customPrompt.trim() : null
        }
      })
    });
    const payload = await response.json();
    if (!response.ok) { setImageUsage(payload.rateLimit ?? imageUsage); return setError(payload.error || "Eddy could not generate a cover image right now."); }
    setImageUsage(payload.usage ?? imageUsage); setImageJob(payload.job); setResult({ title: "Cover image queued", summary: "Eddy will generate and moderate the image in the background.", observations: [], recommendations: [], assumptions: [], basedOn: [] });
  }
  const actionBlocked = usageAction === active && usage?.allowed === false;
  return <Card className="overflow-hidden border-water/25">
    <CardHeader className="bg-water/10"><CardTitle className="flex items-center gap-3"><span className="rounded-lg bg-white/80 p-1.5 dark:bg-white/90"><EddyIcon size={40} className="h-10 w-10" /></span><span><span className="block font-display text-3xl font-normal">Eddy Studio</span><span className="block text-sm font-normal text-muted-foreground">Tank-aware help through the {provider}{fallbackActive ? " fallback" : ""} provider</span></span></CardTitle></CardHeader>
    <CardContent className="space-y-5 pt-5">
      <div className="flex gap-2 overflow-x-auto pb-1">{tools.map((tool) => <Button key={tool.action} type="button" variant={active === tool.action ? "primary" : "secondary"} className="shrink-0" onClick={() => { setActive(tool.action); setResult(null); setError(null); }}>{tool.label}</Button>)}</div>
      <div className="rounded-xl border border-border bg-background/45 p-4">{active === "tank-summary" ? <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Review profile, inhabitants, equipment, lighting, readings, timeline, tasks, husbandry, quarantine, and active medication records.</p><Button onClick={() => run("tank-summary")} disabled={loading || actionBlocked}><EddyIcon size={18} className="mr-2 h-[18px] w-[18px]" />Summarize tank</Button></div> : null}{active === "compatibility" ? <EddyCompatibilityForm onRun={(input) => run("compatibility", input)} loading={loading || actionBlocked} /> : null}{active === "stocking-suggestions" ? <EddyStockingForm onRun={(input) => run("stocking-suggestions", input)} loading={loading || actionBlocked} /> : null}{active === "care-recommendations" ? <EddyCareRecommendationPanel onRun={(input) => run("care-recommendations", input)} loading={loading || actionBlocked} /> : null}{active === "name-ideas" || active === "cover-concepts" ? <div className="space-y-3"><EddyIdentityGenerator imageEnabled={imageEnabled} imageUsage={imageUsage} onGenerateImage={generateImage} onRun={run} loading={loading || actionBlocked} imageLoading={imageLoading} concepts={coverConcepts} selectedConceptId={selectedConceptId} onSelectConcept={setSelectedConceptId} customPrompt={customPrompt} onCustomPromptChange={setCustomPrompt} /><p className="text-xs text-muted-foreground">Concepts include names, subtitles, palettes, motifs, and a cover prompt. {imageEnabled ? "OpenAI image generation is available from the moderated cover workflow." : "Image generation is currently disabled or not configured."}</p></div> : null}{active === "troubleshooting" ? <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Eddy asks for useful missing evidence without pretending to diagnose disease.</p><Button onClick={() => run("troubleshooting")} disabled={loading || actionBlocked}><EddyIcon size={18} className="mr-2 h-[18px] w-[18px]" />Start questions</Button></div> : null}</div>
      {imageJob ? <div className="rounded-lg border border-water/30 bg-water/10 p-3 text-sm"><strong>{imageJob.progressMessage || imageJob.status}</strong><div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-water transition-all" style={{ width: `${imageJob.progress ?? 0}%` }} /></div><div className="mt-2 flex gap-2">{imageJob.status === "PENDING" ? <Button type="button" variant="secondary" onClick={async () => { const response = await fetch(`/api/ai-jobs/${imageJob.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "cancel" }) }); setImageJob((await response.json()).job); setImageLoading(false); }}>Cancel</Button> : null}{["FAILED", "DEAD_LETTER"].includes(imageJob.status) ? <Button type="button" variant="secondary" onClick={async () => { const response = await fetch(`/api/ai-jobs/${imageJob.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "retry" }) }); setImageJob((await response.json()).job); setImageLoading(true); }}>Retry</Button> : null}</div></div> : null}
      {loading ? <EddyLoadingState /> : result ? <EddyMessageCard result={result} nameSuggestionAquariumId={active === "name-ideas" ? aquariumId : undefined} currentAquariumName={aquariumName} allowNameSuggestionApply={active === "name-ideas"} /> : <EddyEmptyState />}{error ? <div className="rounded-lg border border-amber-400/35 bg-amber-400/10 p-3 text-sm">{error}</div> : null}<EddyUsageNote usage={usage} />
    </CardContent>
  </Card>;
}
