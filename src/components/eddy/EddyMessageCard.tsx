import type { EddyResult } from "@/domains/eddy/eddy-types";
import { Badge } from "@/components/ui/badge";
import { EddyIcon } from "@/components/eddy/EddyIcon";
import { EddySuggestionCard } from "@/components/eddy/EddySuggestionCard";

export function EddyMessageCard({ result }: { result: EddyResult }) {
  return <article className="space-y-4 rounded-xl border border-water/25 bg-gradient-to-br from-water/10 via-card to-card p-4 shadow-soft">
    <div className="flex items-start gap-3"><div className="rounded-lg bg-white/75 p-1.5 dark:bg-white/90"><EddyIcon size={36} className="h-9 w-9" /></div><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-display text-2xl leading-none text-primary">{result.title}</h3>{result.verdict ? <Badge>{result.verdict}</Badge> : null}</div><p className="mt-1 text-sm text-muted-foreground">{result.summary}</p></div></div>
    {result.observations.length ? <ResultList title="What Eddy noticed" items={result.observations} /> : null}
    {result.recommendations.length ? <ResultList title="Possible next steps" items={result.recommendations} /> : null}
    {result.suggestions?.length ? <div className="grid gap-2 sm:grid-cols-2">{result.suggestions.map((item, index) => <EddySuggestionCard key={`${item.name}-${index}`} {...item} />)}</div> : null}
    {result.questions?.length ? <ResultList title="Questions to narrow it down" items={result.questions} /> : null}
    {result.assumptions.length ? <ResultList title="Assumptions / missing information" items={result.assumptions} muted /> : null}
    {result.basedOn.length ? <div><h4 className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Based on</h4><div className="mt-2 flex flex-wrap gap-2">{result.basedOn.map((source, index) => <Badge key={`${source.label}-${index}`} className="normal-case tracking-normal">{source.label}: {source.detail}</Badge>)}</div></div> : null}
  </article>;
}

function ResultList({ title, items, muted = false }: { title: string; items: string[]; muted?: boolean }) {
  return <div><h4 className="text-sm font-semibold text-primary">{title}</h4><ul className={`mt-2 space-y-1.5 text-sm ${muted ? "text-muted-foreground" : ""}`}>{items.map((item, index) => <li key={`${item}-${index}`} className="flex gap-2"><span className="text-water">•</span><span>{item}</span></li>)}</ul></div>;
}
