"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { EddyIcon } from "@/components/eddy/EddyIcon";
import { EddyLoadingState } from "@/components/eddy/EddyLoadingState";
import { EddyMessageCard } from "@/components/eddy/EddyMessageCard";
import type { EddyResult } from "@/domains/eddy/eddy-types";

export function EddyPanel() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EddyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const aquariumId = pathname.match(/^\/aquariums\/([^/]+)/)?.[1];
  const speciesDefinitionId = pathname.match(/^\/species\/([^/]+)/)?.[1];
  async function ask() {
    if (!question.trim()) return;
    setLoading(true); setError(null);
    const response = await fetch("/api/eddy/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ aquariumId, speciesDefinitionId, page: pathname, input: { question } }) });
    const payload = await response.json();
    setLoading(false);
    if (!response.ok) return setError(payload.error || "Eddy could not answer right now.");
    setResult(payload);
  }
  return <>
    <button type="button" onClick={() => setOpen(true)} className="flex min-h-10 w-full shrink-0 items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold text-primary transition hover:bg-water/10"><EddyIcon size={24} className="h-6 w-6" />Ask Eddy</button>
    {open ? <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.currentTarget === event.target) setOpen(false); }}>
      <aside role="dialog" aria-modal="true" aria-label="Ask Eddy" className="flex h-full w-full max-w-xl flex-col border-l border-border bg-card shadow-2xl">
        <header className="flex items-center justify-between border-b border-border px-5 py-4"><div className="flex items-center gap-3"><EddyIcon size={40} className="h-10 w-10" /><div><div className="font-display text-2xl text-primary">Ask Eddy</div><div className="text-xs text-muted-foreground">Aware of {pageLabel(pathname)}</div></div></div><Button variant="ghost" onClick={() => setOpen(false)} aria-label="Close Eddy"><X className="h-5 w-5" /></Button></header>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">{loading ? <EddyLoadingState message="Eddy is reviewing the available records…" /> : result ? <EddyMessageCard result={result} /> : <div className="rounded-xl bg-water/10 p-4 text-sm text-muted-foreground">Ask about priorities, husbandry, compatibility, recent records, or what would make this page more useful. Eddy will say when the available data is incomplete.</div>}{error ? <p className="text-sm text-destructive">{error}</p> : null}</div>
        <div className="border-t border-border p-4"><Textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="What should Eddy help with?" className="min-h-24" /><Button onClick={ask} disabled={loading || !question.trim()} className="mt-3 w-full"><EddyIcon size={18} className="mr-2 h-[18px] w-[18px]" />Ask Eddy</Button><p className="mt-2 text-center text-xs text-muted-foreground">Care guidance is informational. Verify medication labels and observe livestock carefully.</p></div>
      </aside>
    </div> : null}
  </>;
}

function pageLabel(pathname: string) {
  if (pathname.startsWith("/aquariums/")) return "this aquarium";
  if (pathname.startsWith("/species/")) return "this species";
  return pathname === "/dashboard" ? "your dashboard" : `the ${pathname.split("/").filter(Boolean).join(" ") || "current"} page`;
}
