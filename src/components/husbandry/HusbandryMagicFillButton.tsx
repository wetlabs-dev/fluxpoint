"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EddyIcon } from "@/components/eddy/EddyIcon";

export function HusbandryMagicFillButton({ speciesDefinitionId, speciesType }: { speciesDefinitionId: string; speciesType: string }) {
  const [draft, setDraft] = useState<Record<string, string | null> | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function fill() {
    setStatus("Drafting...");
    setDraft(null);
    const response = await fetch("/api/eddy/husbandry-fill", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ speciesDefinitionId, input: { speciesType } })
    });
    const payload = await response.json();
    if (!response.ok) {
      setStatus(payload.error ?? "Magic Fill failed.");
      return;
    }
    const fields = payload.fields ?? {};
    setDraft(fields);
    const form = document.querySelector<HTMLInputElement>(`input[name="speciesDefinitionId"][value="${speciesDefinitionId}"]`)?.closest("form");
    if (form) {
      Object.entries(fields).forEach(([key, value]) => {
        const field = form.elements.namedItem(key);
        if ((field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) && value != null) field.value = String(value);
      });
      const statusField = form.elements.namedItem("status");
      if (statusField instanceof HTMLSelectElement) statusField.value = "AI_DRAFT";
    }
    setStatus("Draft applied to the form. Review every value before saving.");
  }

  return (
    <div className="grid gap-2 rounded-md border border-border bg-muted/35 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Eddy drafts the type-specific fields and applies them to this form. Nothing saves until you review and submit.</p>
        <Button type="button" variant="secondary" onClick={fill}><EddyIcon size={18} className="mr-2 h-[18px] w-[18px]" />Magic Fill with Eddy</Button>
      </div>
      {status ? <p className="text-xs text-muted-foreground">{status}</p> : null}
      {draft ? <details className="text-xs text-muted-foreground"><summary className="cursor-pointer font-semibold">Review raw draft JSON</summary><textarea readOnly className="mt-2 min-h-40 w-full rounded-md border border-input bg-background/70 p-3 font-mono text-xs" value={JSON.stringify(draft, null, 2)} /></details> : null}
    </div>
  );
}
