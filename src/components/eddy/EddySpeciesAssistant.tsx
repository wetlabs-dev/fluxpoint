"use client";

import { useState } from "react";
import { EddyButton } from "@/components/eddy/EddyButton";
import { EddyLoadingState } from "@/components/eddy/EddyLoadingState";
import { EddyMessageCard } from "@/components/eddy/EddyMessageCard";
import { EddyUsageNote } from "@/components/eddy/EddyUsageNote";
import type { EddyResult } from "@/domains/eddy/eddy-types";
import type { EddyUsageStatus } from "@/domains/eddy/rate-limits";

export function EddySpeciesAssistant({ speciesDefinitionId, commonName }: { speciesDefinitionId: string; commonName: string }) {
  const [result, setResult] = useState<EddyResult | null>(null); const [usage, setUsage] = useState<EddyUsageStatus | null>(null); const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null);
  async function summarize() { setLoading(true); setError(null); const response = await fetch("/api/eddy/species-care-summary", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ speciesDefinitionId }) }); const payload = await response.json(); setLoading(false); setUsage(payload.usage ?? payload.rateLimit ?? null); if (!response.ok) return setError(payload.error || "Eddy could not summarize this species right now."); setResult(payload); }
  return <div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Use the species definition and current husbandry guide to summarize {commonName}&apos;s recorded care needs.</p><EddyButton type="button" variant="secondary" disabled={loading || usage?.allowed === false} onClick={summarize}>Summarize care needs</EddyButton></div>{loading ? <EddyLoadingState message="Eddy is reviewing this species…" /> : result ? <EddyMessageCard result={result} /> : null}{error ? <div className="rounded-lg border border-amber-400/35 bg-amber-400/10 p-3 text-sm">{error}</div> : null}<EddyUsageNote usage={usage} compact /></div>;
}
