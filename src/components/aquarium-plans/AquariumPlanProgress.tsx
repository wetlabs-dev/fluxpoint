import { Badge } from "@/components/ui/badge";
import type { AquariumPlanProgress as Progress } from "@/domains/aquarium-plans/progress";

export function AquariumPlanProgress({ progress }: { progress: Progress }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-semibold text-primary">{progress.percent}% complete</span>
        <span className="text-muted-foreground">{progress.requiredResolved} of {progress.requiredTotal || 0} required points resolved</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-water transition-all" style={{ width: `${Math.max(0, Math.min(progress.percent, 100))}%` }} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge>{progress.requiredRemaining} required remaining</Badge>
        <Badge>{progress.optionalRemaining} optional remaining</Badge>
        {progress.blockedCount ? <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200">{progress.blockedCount} blocked</Badge> : null}
        {progress.failedCount ? <Badge className="border-destructive/30 bg-destructive/10 text-destructive">{progress.failedCount} failed</Badge> : null}
        {progress.readyToComplete ? <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200">Ready to complete</Badge> : null}
      </div>
    </div>
  );
}
