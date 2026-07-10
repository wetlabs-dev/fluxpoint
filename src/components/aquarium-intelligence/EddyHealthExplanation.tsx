import { EddyIcon } from "@/components/eddy/EddyIcon";

export function EddyHealthExplanation() {
  return (
    <div className="rounded-md border border-water/25 bg-water/10 p-4">
      <div className="flex items-center gap-2 font-semibold text-primary"><EddyIcon className="h-5 w-5" /> Eddy can explain this evidence</div>
      <p className="mt-2 text-sm text-muted-foreground">Eddy should summarize only the saved assessment, parameter analyses, timeline evidence, confidence, and caveats. The deterministic intelligence remains available when AI is disabled.</p>
    </div>
  );
}
