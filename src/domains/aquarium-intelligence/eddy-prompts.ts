import type { AssessmentDraft, ParameterAnalysisDraft, TimelineInsightDraft } from "@/domains/aquarium-intelligence/types";
import { getCurrentAquariumIntelligence } from "@/domains/aquarium-intelligence/queries";

export function buildEddyHealthExplanationPrompt(input: { aquariumName: string; assessment: AssessmentDraft | unknown; parameterAnalyses: ParameterAnalysisDraft[] | unknown[]; timelineInsights: TimelineInsightDraft[] | unknown[] }) {
  return [
    "Explain this Fluxpoint Aquarium Intelligence result using only the supplied deterministic evidence.",
    "Separate measured facts, deterministic interpretations, and uncertainty.",
    "Do not diagnose disease, claim laboratory certainty, invent missing records, or imply temporal correlation proves causation.",
    "Mention missing records when they limit confidence.",
    JSON.stringify(input, null, 2)
  ].join("\n\n");
}

export async function buildEddyHealthEvidence(aquariumId: string, collectionId: string) {
  const intelligence = await getCurrentAquariumIntelligence(aquariumId, collectionId);
  return {
    assessment: intelligence.assessment ? {
      healthState: intelligence.assessment.healthState,
      confidence: intelligence.assessment.confidence,
      assessedAt: intelligence.assessment.assessedAt.toISOString(),
      assessmentWindowStart: intelligence.assessment.assessmentWindowStart.toISOString(),
      assessmentWindowEnd: intelligence.assessment.assessmentWindowEnd.toISOString(),
      summary: intelligence.assessment.summary,
      dataCoverage: intelligence.assessment.dataCoverage,
      domainResults: intelligence.assessment.domainResults,
      factorResults: intelligence.assessment.factorResults,
      recommendationResults: intelligence.assessment.recommendationResults
    } : null,
    parameterAnalyses: intelligence.parameterAnalyses.map((analysis) => ({
      metricKey: analysis.metricKey,
      unit: analysis.unit,
      analyzedAt: analysis.analyzedAt.toISOString(),
      currentValue: analysis.currentValue,
      baselineValue: analysis.baselineValue,
      observationCount: analysis.observationCount,
      sourceType: analysis.sourceType,
      trendState: analysis.trendState,
      stabilityState: analysis.stabilityState,
      concernState: analysis.concernState,
      interpretation: analysis.interpretation,
      evidence: analysis.evidence
    })),
    timelineInsights: intelligence.timelineInsights.map((insight) => ({
      title: insight.title,
      summary: insight.summary,
      confidence: insight.confidence,
      insightType: insight.insightType,
      targetEventAt: insight.targetEventAt?.toISOString() ?? null,
      evidence: insight.evidence,
      caveats: insight.caveats
    })),
    caveats: [
      "This package contains deterministic Fluxpoint results only.",
      "Timeline insights are temporal associations, not proof of cause.",
      "Missing records should be treated as uncertainty."
    ]
  };
}
