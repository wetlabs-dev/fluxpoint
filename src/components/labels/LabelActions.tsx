"use client";

import { useState } from "react";
import { Download, ExternalLink, LoaderCircle, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LabelFormatSelector } from "@/components/labels/LabelFormatSelector";
import { labelTypeLabels } from "@/domains/labels/label-types";
import { defaultLabelOrientation, type LabelMode, type LabelOrientation, type LabelPrintFormat } from "@/domains/labels/label-formats";
import type { LabelType } from "@prisma/client";

type LabelLink = { id: string; labelType: LabelType; filename: string; createdAt: string | Date };

export function LabelActions({ entityType, entityId, allowedTypes, labels = [], canGenerate }: { entityType: string; entityId: string; allowedTypes: LabelType[]; labels?: LabelLink[]; canGenerate: boolean }) {
  const [items, setItems] = useState(labels.map((entry) => ({ ...entry, createdAt: new Date(entry.createdAt).toISOString() })));
  const [busy, setBusy] = useState<LabelType | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [printOptions, setPrintOptions] = useState<{ mode: LabelMode; format: LabelPrintFormat; orientation: LabelOrientation }>({ mode: "FULL", format: "ONE_PER_PAGE_2_25X1_25", orientation: defaultLabelOrientation("ONE_PER_PAGE_2_25X1_25") });
  async function generate(labelType: LabelType) {
    const requestedType = printOptions.mode === "QR_ONLY" ? "SIMPLE_QR" : labelType;
    setBusy(requestedType); setMessage(null);
    const response = await fetch("/api/labels/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ entityType, entityId, labelType: requestedType, labelMode: printOptions.mode, printFormat: printOptions.format, orientation: printOptions.orientation }) });
    const body = await response.json().catch(() => ({}));
    setBusy(null);
    if (!response.ok) return setMessage(body.error || "Label generation failed.");
    setItems((current) => [{ id: body.id, labelType: body.labelType, filename: body.filename, createdAt: new Date().toISOString() }, ...current]);
    setMessage(`${labelTypeLabels[requestedType]} is ready.`);
  }
  const fullTypes = allowedTypes.filter((type) => type !== "SIMPLE_QR");
  return <div className="space-y-4">{canGenerate ? <><LabelFormatSelector onChange={setPrintOptions} /> <div className="flex flex-wrap gap-2">{printOptions.mode === "QR_ONLY" ? <Button type="button" variant="secondary" disabled={Boolean(busy)} onClick={() => generate("SIMPLE_QR")}>{busy === "SIMPLE_QR" ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}QR-only square label</Button> : fullTypes.map((type) => <Button key={type} type="button" variant="secondary" disabled={Boolean(busy)} onClick={() => generate(type)}>{busy === type ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}{labelTypeLabels[type]}</Button>)}</div></> : <p className="text-sm text-muted-foreground">Viewer access can download existing labels; Fishkeeper access or above is required to generate one.</p>}{message ? <p role="status" className="rounded-md bg-muted/55 p-3 text-sm">{message}</p> : null}<div className="space-y-2">{items.length ? items.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-background/55 p-3 text-sm"><span><strong className="text-primary">{labelTypeLabels[item.labelType]}</strong><span className="block text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</span></span><span className="flex gap-2"><a href={`/api/labels/${item.id}`} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center rounded-md border border-border px-3 text-xs font-semibold text-primary hover:bg-muted"><ExternalLink className="mr-1 h-3.5 w-3.5" />Open</a><a href={`/api/labels/${item.id}?download=1`} className="inline-flex min-h-9 items-center rounded-md border border-border px-3 text-xs font-semibold text-primary hover:bg-muted"><Download className="mr-1 h-3.5 w-3.5" />Download</a></span></div>) : <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">No generated labels yet.</p>}</div><p className="text-xs text-muted-foreground">If print controls do not appear in the installed app, open the PDF in your browser or download/share it first.</p></div>;
}
