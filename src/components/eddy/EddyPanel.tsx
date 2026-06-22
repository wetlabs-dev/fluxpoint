"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EddyButton } from "@/components/eddy/EddyButton";
import { EddyCharacter } from "@/components/eddy/EddyCharacter";
import { EddyIcon } from "@/components/eddy/EddyIcon";
import { EddyLoadingState } from "@/components/eddy/EddyLoadingState";
import { EddyMessageCard } from "@/components/eddy/EddyMessageCard";
import { EddyUsageNote } from "@/components/eddy/EddyUsageNote";
import type { EddyAction, EddyResult } from "@/domains/eddy/eddy-types";
import type { EddyUsageStatus } from "@/domains/eddy/rate-limits";
import { cn } from "@/lib/utils/cn";
import { createPortal } from "react-dom";
import { featureForEddyAction } from "@/domains/eddy/eddy-features";

type ContextTool = { action: EddyAction; label: string; description: string; input?: Record<string, unknown> };

export function EddyPanel({ triggerClassName }: { triggerClassName?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<EddyResult | null>(null);
  const [usage, setUsage] = useState<EddyUsageStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const aquariumId = pathname.match(/^\/aquariums\/([^/]+)/)?.[1];
  const speciesDefinitionId = pathname.match(/^\/species\/([^/]+)/)?.[1];
  const tools = toolsForPage(pathname);

  async function run(tool: ContextTool) {
    setLoading(tool.label); setError(null); setResult(null); setUsage(null);
    const response = await fetch(`/api/eddy/${tool.action}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ aquariumId, speciesDefinitionId, page: pathname, input: tool.input ?? {} }) });
    const payload = await response.json();
    setLoading(null);
    if (!response.ok) { setUsage(payload.rateLimit ?? null); return setError(payload.error || "Eddy could not complete that tool right now."); }
    setUsage(payload.usage ?? null); setResult(payload);
  }

  return <>
    <button type="button" onClick={() => setOpen(true)} className={cn("flex min-h-10 w-auto shrink-0 items-center gap-3 whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold text-primary transition hover:bg-water/10 lg:w-full", triggerClassName)}><EddyIcon size={24} className="h-6 w-6" />Ask Eddy</button>
    {open ? createPortal(<div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.currentTarget === event.target) setOpen(false); }}>
      <aside role="dialog" aria-modal="true" aria-label="Eddy tools" className="flex h-full w-full max-w-xl flex-col border-l border-border bg-card shadow-2xl">
        <header className="flex items-center justify-between border-b border-border px-5 py-4"><div className="flex items-center gap-3"><EddyIcon size={40} className="h-10 w-10" /><div><div className="font-display text-2xl text-primary">Eddy tools</div><div className="text-xs text-muted-foreground">For {pageLabel(pathname)}</div></div></div><Button variant="ghost" onClick={() => setOpen(false)} aria-label="Close Eddy"><X className="h-5 w-5" /></Button></header>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {loading ? <EddyLoadingState message={`Eddy is preparing ${loading.toLowerCase()}…`} /> : result ? <EddyMessageCard result={result} /> : <div className="grid items-center gap-5 overflow-hidden rounded-xl border border-water/25 bg-water/10 p-5 sm:grid-cols-[minmax(0,1fr)_170px]"><div><h3 className="font-display text-2xl text-primary">Choose a focused tool</h3><p className="mt-1 text-sm text-muted-foreground">Eddy uses the records already attached to this workspace and stays inside the aquarium task you select.</p></div><EddyCharacter side="right" className="mx-auto max-h-52 w-auto" /></div>}
          {aquariumId ? <Link href={`/aquariums/${aquariumId}?workspace=eddy#eddy-studio`} onClick={() => setOpen(false)} className="flex min-h-12 items-center gap-3 rounded-md border border-water/30 bg-water/10 px-4 py-3 text-sm font-semibold text-primary hover:bg-water/15"><EddyIcon size={24} />Open Eddy Parameter Advisor</Link> : null}
          <div className="grid gap-2">{tools.map((tool) => <EddyButton key={`${tool.action}-${tool.label}`} type="button" variant="secondary" className="h-auto justify-start px-4 py-3 text-left" disabled={Boolean(loading) || (usage?.allowed === false && featureForEddyAction(tool.action) === usage.featureKey)} onClick={() => run(tool)}><span><span className="block text-sm font-semibold">{tool.label}</span><span className="mt-0.5 block text-xs font-normal text-muted-foreground">{tool.description}</span></span></EddyButton>)}</div>
          {error ? <div className="rounded-lg border border-amber-400/35 bg-amber-400/10 p-3 text-sm text-foreground">{error}</div> : null}
          <EddyUsageNote usage={usage} compact />
        </div>
        <div className="border-t border-border p-4 text-center text-xs text-muted-foreground">Eddy is a structured aquarium assistant. Verify medication labels and observe livestock carefully.</div>
      </aside>
    </div>, document.body) : null}
  </>;
}

function toolsForPage(pathname: string): ContextTool[] {
  if (pathname.startsWith("/aquariums/")) return [
    { action: "tank-summary", label: "Summarize this tank", description: "Review the aquarium's current recorded state." },
    { action: "care-recommendations", label: "What needs attention?", description: "Prioritize readings, tasks, and recent events.", input: { timeframe: "this week" } },
    { action: "cover-concepts", label: "Generate cover ideas", description: "Draft palettes, motifs, and a cover prompt." },
    { action: "troubleshooting", label: "Start troubleshooting", description: "Generate careful questions without claiming a diagnosis." }
  ];
  if (pathname.startsWith("/species/")) return [
    { action: "species-care-summary", label: "Summarize care needs", description: "Review recorded husbandry and identify missing information." },
    { action: "husbandry-fill", label: "Draft husbandry fields", description: "Create a review-only draft using the species field registry." }
  ];
  return [
    { action: "care-digest", label: "What is due today?", description: "Review due and overdue collection care.", input: { timeframe: "today" } },
    { action: "care-digest", label: "Prepare this week's care digest", description: "Summarize practical priorities across active aquariums.", input: { timeframe: "this week" } }
  ];
}

function pageLabel(pathname: string) {
  if (pathname.startsWith("/aquariums/")) return "this aquarium";
  if (pathname.startsWith("/species/")) return "this species";
  return pathname === "/dashboard" ? "your dashboard" : `the ${pathname.split("/").filter(Boolean).join(" ") || "current"} workspace`;
}
