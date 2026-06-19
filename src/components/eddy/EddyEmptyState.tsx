import { EddyCharacter } from "@/components/eddy/EddyCharacter";

export function EddyEmptyState({ title = "What should Eddy look at?", detail = "Choose a tool and Eddy will use the records already attached to this tank." }: { title?: string; detail?: string }) {
  return <div className="grid items-center gap-4 overflow-hidden rounded-xl border border-dashed border-water/35 bg-water/5 px-6 py-6 text-center sm:grid-cols-[150px_minmax(0,1fr)] sm:text-left"><EddyCharacter side="left" className="mx-auto max-h-44 w-auto" /><div><div className="font-display text-2xl text-primary">{title}</div><p className="mt-1 max-w-md text-sm text-muted-foreground">{detail}</p></div></div>;
}
