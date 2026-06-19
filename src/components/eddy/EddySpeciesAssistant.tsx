"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { EddyButton } from "@/components/eddy/EddyButton";
import { EddyLoadingState } from "@/components/eddy/EddyLoadingState";
import { EddyMessageCard } from "@/components/eddy/EddyMessageCard";
import type { EddyResult } from "@/domains/eddy/eddy-types";

export function EddySpeciesAssistant({ speciesDefinitionId, commonName }: { speciesDefinitionId: string; commonName: string }) {
  const [result, setResult] = useState<EddyResult | null>(null); const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null);
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setLoading(true); setError(null); const question = String(new FormData(event.currentTarget).get("question") || ""); const response = await fetch("/api/eddy/species", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ speciesDefinitionId, input: { question } }) }); const payload = await response.json(); setLoading(false); if (!response.ok) return setError(payload.error || "Eddy could not answer right now."); setResult(payload); }
  return <div className="space-y-4"><form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row"><Input name="question" required placeholder={`Ask about ${commonName} care, behavior, or compatibility…`} /><EddyButton type="submit" variant="secondary" disabled={loading}>Ask Eddy</EddyButton></form>{loading ? <EddyLoadingState message="Eddy is reviewing this species…" /> : result ? <EddyMessageCard result={result} /> : null}{error ? <p className="text-sm text-destructive">{error}</p> : null}</div>;
}
