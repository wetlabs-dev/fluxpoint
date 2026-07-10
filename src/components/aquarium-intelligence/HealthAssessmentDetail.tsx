import { refreshAquariumIntelligence } from "@/domains/aquarium-intelligence/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataSufficiencyNotice } from "@/components/aquarium-intelligence/DataSufficiencyNotice";
import { HealthDomainBreakdown, formatState, stateClass } from "@/components/aquarium-intelligence/HealthDomainBreakdown";
import { HealthFactorList } from "@/components/aquarium-intelligence/HealthFactorList";

type Assessment = { healthState: string; confidence: string; summary: string | null; dataCoverage: unknown; domainResults: unknown; factorResults: unknown };

export function HealthAssessmentDetail({ aquariumId, assessment, stale, staleReasons = [] }: { aquariumId: string; assessment: Assessment | null; stale: boolean; staleReasons?: string[] }) {
  const coverage = assessment?.dataCoverage && typeof assessment.dataCoverage === "object" ? assessment.dataCoverage as never : null;
  const domains = assessment?.domainResults && typeof assessment.domainResults === "object" ? Object.values(assessment.domainResults as Record<string, never>) : [];
  const factors = assessment?.factorResults && typeof assessment.factorResults === "object" ? assessment.factorResults as { attention?: never[]; favorable?: never[] } : {};
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Aquarium health assessment</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Qualitative state, confidence, evidence, and missing context are kept separate.</p>
          </div>
          {assessment ? <span className={`rounded-md px-2 py-1 text-xs font-semibold ${stateClass(assessment.healthState)}`}>{formatState(assessment.healthState)} · {formatState(assessment.confidence)}</span> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {assessment ? (
          <>
            <p className="text-sm">{assessment.summary}</p>
            {stale ? <DataSufficiencyNotice coverage={{ ...(coverage ?? {}), missing: staleReasons.length ? staleReasons : ["records changed after this assessment"] }} /> : <DataSufficiencyNotice coverage={coverage} />}
            <div>
              <h3 className="mb-2 text-sm font-semibold text-primary">Attention factors</h3>
              <HealthFactorList factors={factors.attention ?? []} emptyText="No attention factors found." />
            </div>
            <HealthDomainBreakdown domains={domains} />
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">No saved assessment yet.</p>
            <form action={refreshAquariumIntelligence}><input type="hidden" name="aquariumId" value={aquariumId} /><Button type="submit">Refresh assessment</Button></form>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
