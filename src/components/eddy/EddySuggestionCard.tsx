export function EddySuggestionCard({ name, detail, caution }: { name: string; detail: string; caution?: string }) {
  return <div className="rounded-lg border border-border bg-background/55 p-3"><div className="font-semibold text-primary">{name}</div><p className="mt-1 text-sm text-muted-foreground">{detail}</p>{caution ? <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300">Caution: {caution}</p> : null}</div>;
}
