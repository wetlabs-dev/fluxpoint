"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { EddyIcon } from "@/components/eddy/EddyIcon";
import { EddyUsageNote } from "@/components/eddy/EddyUsageNote";
import type { EddyUsageStatus } from "@/domains/eddy/rate-limits";

export function HusbandryMagicFillButton({ speciesDefinitionId, speciesType }: { speciesDefinitionId: string; speciesType: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<{ fields: Record<string, string | null>; guideSummary: string | null; careDifficulty: string | null } | null>(null);
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
    setDraft({ fields, guideSummary: payload.guideSummary ?? null, careDifficulty: payload.careDifficulty ?? null });
    setRequestLogId(String(payload.requestLogId ?? ""));
    setStatus("Draft ready. Review the proposed values, then apply them to the form.");
  }

  function applyDraft() {
    if (!draft) return;
    const form = rootRef.current?.closest("form");
    if (!form) {
      setStatus("Could not find the husbandry form. Refresh the page and try again.");
      return;
    }
    const applyValue = (key: string, value: string | null | undefined) => {
      if (value == null) return;
      const field = form.elements.namedItem(key);
      if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
        field.value = String(value);
        field.dispatchEvent(new Event("input", { bubbles: true }));
        field.dispatchEvent(new Event("change", { bubbles: true }));
      }
    };
    applyValue("summary", draft.guideSummary);
    applyValue("careDifficulty", draft.careDifficulty);
    Object.entries(draft.fields).forEach(([key, value]) => applyValue(key, value));
    applyValue("status", "AI_DRAFT");
    const requestLogField = form.elements.namedItem("husbandryMagicFillRequestLogId");
    if (requestLogField instanceof HTMLInputElement) requestLogField.value = requestLogId;
    setStatus("Draft applied to the form. Review every value before saving.");
  }

  return (
    <div ref={rootRef} className="grid gap-2 rounded-md border border-border bg-muted/35 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Eddy drafts the type-specific fields and applies them to this form. Nothing saves until you review and submit.</p>
        <Button type="button" variant="secondary" onClick={fill} disabled={usage?.allowed === false}><EddyIcon size={18} className="mr-2 h-[18px] w-[18px]" />Magic Fill with Eddy</Button>
      </div>
      {status ? <p className="text-xs text-muted-foreground">{status}</p> : null}
      <EddyUsageNote usage={usage} compact />
      {draft ? <div className="grid gap-2 rounded-md border border-border bg-background/55 p-3 text-xs text-muted-foreground"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold text-primary">{Object.values(draft.fields).filter(Boolean).length + Number(Boolean(draft.guideSummary)) + Number(Boolean(draft.careDifficulty))} proposed field(s)</span><Button type="button" className="min-h-8 px-3 py-1 text-xs" onClick={applyDraft}>Apply draft to form</Button></div>{draft.guideSummary || draft.careDifficulty ? <div className="rounded-md bg-muted/45 p-2"><p className="font-semibold text-primary">Guide header</p>{draft.careDifficulty ? <p>Care difficulty: {draft.careDifficulty}</p> : null}{draft.guideSummary ? <p className="mt-1">{draft.guideSummary}</p> : null}</div> : null}<details><summary className="cursor-pointer font-semibold">Review raw draft JSON</summary><textarea readOnly className="mt-2 min-h-40 w-full rounded-md border border-input bg-background/70 p-3 font-mono text-xs" value={JSON.stringify(draft, null, 2)} /></details></div> : null}
    </div>
  );
}
