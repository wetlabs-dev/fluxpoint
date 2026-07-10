import { format } from "date-fns";
import { formatState, stateClass } from "@/components/aquarium-intelligence/HealthDomainBreakdown";

type Assessment = { id: string; healthState: string; confidence: string; assessedAt: Date; summary: string | null };

export function IntelligenceHistory({ assessments }: { assessments: Assessment[] }) {
  if (!assessments.length) return <p className="text-sm text-muted-foreground">No historical assessments yet.</p>;
  return (
    <div className="space-y-2">
      {assessments.map((assessment, index) => (
        <div key={assessment.id} className="flex items-start justify-between gap-3 rounded-md border border-border bg-background/60 p-3">
          <div>
            <div className="text-sm font-semibold">{format(assessment.assessedAt, "MMM d, yyyy h:mm a")}</div>
            <p className="mt-1 text-sm text-muted-foreground">{assessment.summary}</p>
          </div>
          <div className="text-right">
            <span className={`rounded-md px-2 py-1 text-xs font-semibold ${stateClass(assessment.healthState)}`}>{formatState(assessment.healthState)}</span>
            {index < assessments.length - 1 && assessments[index + 1].healthState !== assessment.healthState ? <div className="mt-2 text-xs text-muted-foreground">{formatState(assessments[index + 1].healthState)} to {formatState(assessment.healthState)}</div> : null}
          </div>
        </div>
      ))}
    </div>
  );
}
