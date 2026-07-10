"use client";

import { useState } from "react";
import { EddyIcon } from "@/components/eddy/EddyIcon";
import { EddyMessageCard } from "@/components/eddy/EddyMessageCard";
import { EddyLoadingState } from "@/components/eddy/EddyLoadingState";
import { EddyUsageNote } from "@/components/eddy/EddyUsageNote";
import { Button } from "@/components/ui/button";
import type { EddyResult } from "@/domains/eddy/eddy-types";
import type { EddyUsageStatus } from "@/domains/eddy/rate-limits";

export function EddyHealthExplanation({ aquariumId }: { aquariumId: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EddyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<EddyUsageStatus | null>(null);

  async function explain() {
    setLoading(true);
    setError(null);
    setResult(null);
    const response = await fetch("/api/eddy/health-explanation", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ aquariumId }) });
    const payload = await response.json();
    setLoading(false);
    if (!response.ok) {
      setUsage(payload.rateLimit ?? null);
      setError(payload.error || "Eddy could not explain this assessment.");
      return;
    }
    setUsage(payload.usage ?? null);
    setResult(payload);
  }

  return (
    <div className="space-y-3 rounded-md border border-water/25 bg-water/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 font-semibold text-primary"><EddyIcon className="h-5 w-5" /> Eddy can explain this evidence</div>
          <p className="mt-2 text-sm text-muted-foreground">Eddy receives only the saved assessment, parameter analyses, timeline evidence, confidence, and caveats. Deterministic intelligence remains available when AI is disabled.</p>
        </div>
        <Button type="button" onClick={explain} disabled={loading}><EddyIcon size={18} className="mr-2 h-[18px] w-[18px]" />Explain health</Button>
      </div>
      {loading ? <EddyLoadingState /> : result ? <EddyMessageCard result={result} /> : null}
      {error ? <div className="rounded-md border border-amber-400/35 bg-amber-400/10 p-3 text-sm">{error}</div> : null}
      <EddyUsageNote usage={usage} />
    </div>
  );
}
