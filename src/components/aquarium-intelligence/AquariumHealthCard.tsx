import Link from "next/link";
import { format } from "date-fns";
import { Activity, RefreshCw } from "lucide-react";
import { refreshAquariumIntelligence } from "@/domains/aquarium-intelligence/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatState, stateClass } from "@/components/aquarium-intelligence/HealthDomainBreakdown";
import { HealthFactorList } from "@/components/aquarium-intelligence/HealthFactorList";

type Assessment = { healthState: string; confidence: string; assessedAt: Date; summary: string | null; factorResults: unknown };

export function AquariumHealthCard({ aquariumId, assessment, stale }: { aquariumId: string; assessment: Assessment | null; stale: boolean }) {
  const factors = parseFactors(assessment?.factorResults);
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-water" /> Aquarium Health</CardTitle>
          <span className={`rounded-md px-2 py-1 text-xs font-semibold ${stateClass(assessment?.healthState)}`}>{assessment ? formatState(assessment.healthState) : "Not assessed"}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {assessment ? (
          <>
            <div className="text-sm text-muted-foreground">
              {formatState(assessment.healthState)} · {formatState(assessment.confidence)} confidence · assessed {format(assessment.assessedAt, "MMM d, yyyy h:mm a")}
              {stale ? <span className="font-semibold text-amber-700 dark:text-amber-200"> · refresh available</span> : <span> · current</span>}
            </div>
            <p className="text-sm">{assessment.summary}</p>
            <HealthFactorList factors={factors.attention.slice(0, 3)} emptyText={factors.favorable[0]?.explanation ?? "No high-priority attention factors found."} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No saved assessment yet. Refresh to analyze water quality, stocking, maintenance, workflows, stability, conditions, and mortality.</p>
        )}
        <div className="flex flex-wrap gap-2">
          <Link href={`/aquariums/${aquariumId}?workspace=intelligence#workspace`} className="inline-flex min-h-10 items-center rounded-md border border-border px-4 py-2 text-sm font-semibold text-primary">View health details</Link>
          <form action={refreshAquariumIntelligence}>
            <input type="hidden" name="aquariumId" value={aquariumId} />
            <Button type="submit" variant="secondary"><RefreshCw className="mr-2 h-4 w-4" /> Refresh assessment</Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}

function parseFactors(value: unknown): { attention: Array<{ explanation?: string; severity?: string; source?: string; occurredAt?: string }>; favorable: Array<{ explanation?: string; severity?: string; source?: string; occurredAt?: string }> } {
  if (!value || typeof value !== "object") return { attention: [], favorable: [] };
  const record = value as { attention?: unknown; favorable?: unknown };
  return { attention: Array.isArray(record.attention) ? record.attention as never[] : [], favorable: Array.isArray(record.favorable) ? record.favorable as never[] : [] };
}
