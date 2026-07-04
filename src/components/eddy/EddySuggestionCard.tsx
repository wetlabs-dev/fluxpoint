import { selectAiSuggestion } from "@/domains/aquariums/actions";

export function EddySuggestionCard({ name, detail, caution, aquariumId, currentAquariumName, allowApplyAsName }: { name: string; detail: string; caution?: string; aquariumId?: string; currentAquariumName?: string; allowApplyAsName?: boolean }) {
  const replacesCurrentName = Boolean(allowApplyAsName && currentAquariumName && currentAquariumName !== name);
  return <div className="rounded-lg border border-border bg-background/55 p-3">
    <div className="font-semibold text-primary">{name}</div>
    <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    {caution ? <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300">Caution: {caution}</p> : null}
    {allowApplyAsName && aquariumId ? (
      <form action={selectAiSuggestion} className="mt-3 space-y-2 rounded-md border border-border bg-card/70 p-2">
        <input type="hidden" name="aquariumId" value={aquariumId} />
        <input type="hidden" name="suggestionType" value="TANK_NAME" />
        <input type="hidden" name="value" value={name} />
        {replacesCurrentName ? (
          <label className="flex gap-2 text-xs text-muted-foreground">
            <input className="mt-0.5" type="checkbox" name="confirmReplace" required />
            <span>Replace current display name “{currentAquariumName}” with “{name}”.</span>
          </label>
        ) : null}
        <button type="submit" className="rounded-md border border-primary/35 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary hover:text-primary-foreground">Use as display name</button>
      </form>
    ) : null}
  </div>;
}
