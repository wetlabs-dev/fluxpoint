"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EddyIcon } from "@/components/eddy/EddyIcon";
import { EddyUsageNote } from "@/components/eddy/EddyUsageNote";
import type { EddyUsageStatus } from "@/domains/eddy/rate-limits";

export function HusbandryMagicFillButton({ speciesDefinitionId, speciesType }: { speciesDefinitionId: string; speciesType: string }) {
  const [draft, setDraft] = useState<Record<string, string | null> | null>(null);
  const [requestLogId, setRequestLogId] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [usage, setUsage] = useState<EddyUsageStatus | null>(null);

  async function fill() {
    setStatus("Drafting...");
    setDraft(null);
    const response = await fetch("/api/eddy/husbandry-fill", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ speciesDefinitionId, input: { speciesType } })
    });
    const payload = await response.json();
    setUsage(payload.usage ?? payload.rateLimit ?? null);
    if (!response.ok) {
      setStatus(payload.error ?? "Magic Fill failed.");
      return;
    }
    const fields = payload.fields ?? {};
    setDraft(fields);
    setRequestLogId(String(payload.requestLogId ?? ""));
    setStatus("Draft ready. Review the proposed values, then apply them to the form.");
  }

  function applyDraft() {
    if (!draft) return;
    const form = document.querySelector<HTMLInputElement>(`input[name="speciesDefinitionId"][value="${speciesDefinitionId}"]`)?.closest("form");
    if (form) {
      Object.entries(draft).forEach(([key, value]) => {
        const field = form.elements.namedItem(key);
        if ((field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) && value != null) field.value = String(value);
      });
      const statusField = form.elements.namedItem("status");
      if (statusField instanceof HTMLSelectElement) statusField.value = "AI_DRAFT";
      const requestLogField = form.elements.namedItem("husbandryMagicFillRequestLogId");
      if (requestLogField instanceof HTMLInputElement) requestLogField.value = requestLogId;
    }
    setStatus("Draft applied to the form. Review every value before saving.");
  }

  return (
    <div className="grid gap-2 rounded-md border border-border bg-muted/35 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Eddy drafts the type-specific fields and applies them to this form. Nothing saves until you review and submit.</p>
        <Button type="button" variant="secondary" onClick={fill} disabled={usage?.allowed === false}><EddyIcon size={18} className="mr-2 h-[18px] w-[18px]" />Magic Fill with Eddy</Button>
      </div>
      {status ? <p className="text-xs text-muted-foreground">{status}</p> : null}
      <EddyUsageNote usage={usage} compact />
      {draft ? <div className="grid gap-2 rounded-md border border-border bg-background/55 p-3 text-xs text-muted-foreground"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold text-primary">{Object.values(draft).filter(Boolean).length} proposed field(s)</span><Button type="button" className="min-h-8 px-3 py-1 text-xs" onClick={applyDraft}>Apply draft to form</Button></div><details><summary className="cursor-pointer font-semibold">Review raw draft JSON</summary><textarea readOnly className="mt-2 min-h-40 w-full rounded-md border border-input bg-background/70 p-3 font-mono text-xs" value={JSON.stringify(draft, null, 2)} /></details></div> : null}
    </div>
  );
}
