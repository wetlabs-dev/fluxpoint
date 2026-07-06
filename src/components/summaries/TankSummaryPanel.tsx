"use client";

import { useMemo, useState } from "react";
import { Clipboard, Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/input";
import type { TankSummaryFormat, TankSummaryMode } from "@/domains/summaries/tank-summary";

type SummaryTexts = Record<TankSummaryMode, Record<TankSummaryFormat, string>>;

export function TankSummaryPanel({
  title = "Concise summary",
  description,
  filenameBase,
  texts
}: {
  title?: string;
  description?: string;
  filenameBase: string;
  texts: SummaryTexts;
}) {
  const [mode, setMode] = useState<TankSummaryMode>("standard");
  const [format, setFormat] = useState<TankSummaryFormat>("plain");
  const [copied, setCopied] = useState(false);
  const text = texts[mode][format];
  const filename = useMemo(() => `${filenameBase}-${mode}.${format === "markdown" ? "md" : "txt"}`, [filenameBase, mode, format]);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function download() {
    const blob = new Blob([text], { type: format === "markdown" ? "text/markdown;charset=utf-8" : "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-primary">{title}</h3>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={copy}><Clipboard className="mr-2 h-4 w-4" />{copied ? "Copied" : "Copy"}</Button>
          <Button type="button" variant="secondary" onClick={download}><Download className="mr-2 h-4 w-4" />Download</Button>
          <Button type="button" variant="ghost" onClick={() => window.location.reload()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium">
          <span>Mode</span>
          <Select value={mode} onChange={(event) => setMode(event.target.value as TankSummaryMode)}>
            <option value="compact">Compact</option>
            <option value="standard">Standard</option>
            <option value="detailed">Detailed</option>
          </Select>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          <span>Format</span>
          <Select value={format} onChange={(event) => setFormat(event.target.value as TankSummaryFormat)}>
            <option value="plain">Plain text</option>
            <option value="markdown">Markdown</option>
          </Select>
        </label>
      </div>
      <Textarea className="mt-4 min-h-80 font-mono text-xs leading-relaxed" value={text} readOnly />
    </section>
  );
}
