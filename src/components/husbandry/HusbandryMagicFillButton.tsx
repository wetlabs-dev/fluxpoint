"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HusbandryMagicFillButton({ speciesDefinitionId, speciesType }: { speciesDefinitionId: string; speciesType: string }) {
  const [draft, setDraft] = useState<Record<string, string | null> | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function fill() {
    setStatus("Drafting...");
    setDraft(null);
    const response = await fetch("/api/ai/species-husbandry-fill", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ speciesDefinitionId, speciesType })
    });
    const payload = await response.json();
    if (!response.ok) {
      setStatus(payload.error ?? "Magic Fill failed.");
      return;
    }
    setDraft(payload.fields ?? {});
    setStatus("Draft ready. Review and paste values into the guide before saving.");
  }

  return (
    <div className="grid gap-2 rounded-md border border-border bg-muted/35 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Magic Fill drafts husbandry JSON. It does not save until you review and submit the guide.</p>
        <Button type="button" variant="secondary" onClick={fill}><Sparkles className="mr-2 h-4 w-4" />Magic Fill draft</Button>
      </div>
      {status ? <p className="text-xs text-muted-foreground">{status}</p> : null}
      {draft ? <textarea readOnly className="min-h-40 w-full rounded-md border border-input bg-background/70 p-3 font-mono text-xs" value={JSON.stringify(draft, null, 2)} /> : null}
    </div>
  );
}
