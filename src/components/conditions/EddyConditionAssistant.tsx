"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EddyConditionResult } from "@/domains/conditions/eddy-condition";

export function EddyConditionAssistant({ conditionId }: { conditionId: string }) {
  const [result, setResult] = useState<EddyConditionResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true); setMessage(null);
    const response = await fetch("/api/eddy/condition-review", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ conditionId }) });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setMessage(body.error || "Eddy could not review this condition.");
    setResult(body);
  }
  return <Card className="border-water/30 bg-water/10"><CardHeader><CardTitle><Sparkles className="mr-2 inline h-5 w-5" />Ask Eddy</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-sm text-muted-foreground">Summarize the record and draft a checklist. Eddy will not diagnose or prescribe.</p><Button type="button" variant="secondary" onClick={run} disabled={busy}>{busy ? "Reviewing…" : "Review condition"}</Button>{message ? <p role="alert" className="text-sm text-rose-600">{message}</p> : null}{result ? <div className="space-y-3 text-sm"><p>{result.summary}</p><List title="Observe" items={result.checklist} /><List title="Investigate" items={result.investigate} /><div><strong>Follow-up:</strong> {result.followUpCadence}</div><p className="rounded-md bg-background/55 p-3 text-xs text-muted-foreground">{result.safetyNote}</p></div> : null}</CardContent></Card>;
}

function List({ title, items }: { title: string; items: string[] }) { return <div><div className="font-semibold text-primary">{title}</div><ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">{items.map((item) => <li key={item}>{item}</li>)}</ul></div>; }
