import { EddyIcon } from "@/components/eddy/EddyIcon";

export function EddyEmptyState({ title = "What should Eddy look at?", detail = "Choose a tool and Eddy will use the records already attached to this tank." }: { title?: string; detail?: string }) {
  return <div className="flex flex-col items-center rounded-xl border border-dashed border-water/35 bg-water/5 px-6 py-8 text-center"><EddyIcon size={56} className="mb-3 h-14 w-14" /><div className="font-display text-2xl text-primary">{title}</div><p className="mt-1 max-w-md text-sm text-muted-foreground">{detail}</p></div>;
}
