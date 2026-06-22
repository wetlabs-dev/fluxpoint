"use client";

import { useState } from "react";
import { Download, LoaderCircle, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { labelTypeLabels } from "@/domains/labels/label-types";
import type { LabelType } from "@prisma/client";

type LabelLink = { id: string; labelType: LabelType; filename: string; createdAt: string | Date };

export function LabelActions({ entityType, entityId, allowedTypes, labels = [], canGenerate }: { entityType: string; entityId: string; allowedTypes: LabelType[]; labels?: LabelLink[]; canGenerate: boolean }) {
  const [items, setItems] = useState(labels.map((entry) => ({ ...entry, createdAt: new Date(entry.createdAt).toISOString() })));
  const [busy, setBusy] = useState<LabelType | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  async function generate(labelType: LabelType) {
    setBusy(labelType); setMessage(null);
    const response = await fetch("/api/labels/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ entityType, entityId, labelType }) });
    const body = await response.json().catch(() => ({}));
    setBusy(null);
    if (!response.ok) return setMessage(body.error || "Label generation failed.");
    setItems((current) => [{ id: body.id, labelType: body.labelType, filename: body.filename, createdAt: new Date().toISOString() }, ...current]);
    setMessage(`${labelTypeLabels[labelType]} is ready.`);
  }
  return <div className="space-y-4">{canGenerate ? <div className="flex flex-wrap gap-2">{allowedTypes.map((type) => <Button key={type} type="button" variant="secondary" disabled={Boolean(busy)} onClick={() => generate(type)}>{busy === type ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}{labelTypeLabels[type]}</Button>)}</div> : <p className="text-sm text-muted-foreground">Viewer access can download existing labels; Fishkeeper access or above is required to generate one.</p>}{message ? <p role="status" className="rounded-md bg-muted/55 p-3 text-sm">{message}</p> : null}<div className="space-y-2">{items.length ? items.map((item) => <a key={item.id} href={`/api/labels/${item.id}`} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-md border border-border bg-background/55 p-3 text-sm"><span><strong className="text-primary">{labelTypeLabels[item.labelType]}</strong><span className="block text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</span></span><Download className="h-4 w-4" /></a>) : <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">No generated labels yet.</p>}</div></div>;
}
