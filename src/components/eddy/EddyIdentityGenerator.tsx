import { EddyButton } from "@/components/eddy/EddyButton";
import { EddyUsageNote } from "@/components/eddy/EddyUsageNote";
import type { EddyUsageStatus } from "@/domains/eddy/rate-limits";
import type { EddyResult } from "@/domains/eddy/eddy-types";

type CoverConcept = NonNullable<EddyResult["suggestions"]>[number];

export function EddyIdentityGenerator({
  imageEnabled,
  imageUsage,
  onGenerateImage,
  onRun,
  loading,
  imageLoading,
  concepts,
  selectedConceptId,
  onSelectConcept,
  customPrompt,
  onCustomPromptChange
}: {
  imageEnabled?: boolean;
  imageUsage?: EddyUsageStatus | null;
  onGenerateImage: () => void;
  onRun: (action: "name-ideas" | "cover-concepts", input: Record<string, unknown>) => void;
  loading: boolean;
  imageLoading: boolean;
  concepts?: CoverConcept[];
  selectedConceptId?: string | null;
  onSelectConcept?: (id: string) => void;
  customPrompt?: string;
  onCustomPromptChange?: (value: string) => void;
}) {
  const hasCustomPrompt = Boolean(customPrompt?.trim());
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <EddyButton type="button" variant="secondary" disabled={loading} onClick={() => onRun("name-ideas", { includeSubtitles: true })}>Generate names</EddyButton>
        <EddyButton type="button" variant="secondary" disabled={loading} onClick={() => onRun("cover-concepts", { includeImagePrompt: true })}>Create cover concepts</EddyButton>
        {imageEnabled ? <EddyButton type="button" variant="secondary" disabled={imageLoading || !imageUsage?.allowed} onClick={onGenerateImage}>{imageLoading ? "Generating cover…" : hasCustomPrompt ? "Generate from custom prompt" : "Generate cover image"}</EddyButton> : null}
      </div>
      {concepts?.length ? (
        <div className="grid gap-3 lg:grid-cols-3">
          {concepts.map((concept, index) => {
            const id = concept.id || concept.title || concept.name || `concept-${index}`;
            const selected = !hasCustomPrompt && selectedConceptId === id;
            const title = concept.title || concept.name;
            const description = concept.description || concept.detail;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelectConcept?.(id)}
                className={`rounded-xl border p-4 text-left transition ${selected ? "border-primary bg-primary/10 shadow-sm ring-2 ring-primary/25" : "border-border bg-background/70 hover:border-primary/45"}`}
              >
                <span className="flex items-start justify-between gap-3">
                  <span>
                    <span className="block text-sm font-semibold text-foreground">{title}</span>
                    {concept.confidenceLabel ? <span className="mt-1 inline-flex rounded-full border border-water/25 bg-water/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">{concept.confidenceLabel}</span> : null}
                  </span>
                  <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${selected ? "border-primary bg-primary" : "border-border bg-muted"}`} aria-hidden>{selected ? <span className="h-2 w-2 rounded-full bg-primary-foreground" /> : null}</span>
                </span>
                <span className="mt-3 block text-sm text-muted-foreground">{description}</span>
                {concept.tags?.length ? <span className="mt-3 flex flex-wrap gap-1.5">{concept.tags.slice(0, 5).map((tag) => <span key={tag} className="rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground">{tag}</span>)}</span> : null}
                {concept.paletteNotes || concept.compositionNotes ? <span className="mt-3 block space-y-1 text-xs text-muted-foreground">{concept.paletteNotes ? <span className="block"><span className="font-semibold text-foreground/80">Palette:</span> {concept.paletteNotes}</span> : null}{concept.compositionNotes ? <span className="block"><span className="font-semibold text-foreground/80">Composition:</span> {concept.compositionNotes}</span> : null}</span> : null}
                {concept.cautions?.length || concept.caution ? <span className="mt-3 block text-xs text-amber-700 dark:text-amber-300">{concept.caution || concept.cautions?.[0]}</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}
      {imageEnabled ? (
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground" htmlFor="eddy-cover-custom-prompt">Custom prompt override</label>
          <textarea
            id="eddy-cover-custom-prompt"
            value={customPrompt ?? ""}
            onChange={(event) => onCustomPromptChange?.(event.target.value)}
            rows={3}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="Optional: describe the cover direction. If filled, Eddy uses this instead of the selected concept."
          />
        </div>
      ) : null}
      {imageEnabled ? <EddyUsageNote usage={imageUsage} compact /> : null}
    </div>
  );
}
