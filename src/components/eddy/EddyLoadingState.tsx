import { EddyIcon } from "@/components/eddy/EddyIcon";

export function EddyLoadingState({ message = "Eddy is reviewing this tank…" }: { message?: string }) {
  return <div className="flex items-center gap-3 rounded-lg border border-water/25 bg-water/10 p-4 text-sm text-muted-foreground"><EddyIcon size={28} className="h-7 w-7 animate-pulse" /><span>{message}</span></div>;
}
