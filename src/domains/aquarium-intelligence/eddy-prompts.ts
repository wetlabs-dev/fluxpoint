import type { AssessmentDraft, ParameterAnalysisDraft, TimelineInsightDraft } from "@/domains/aquarium-intelligence/types";

export function buildEddyHealthExplanationPrompt(input: { aquariumName: string; assessment: AssessmentDraft | unknown; parameterAnalyses: ParameterAnalysisDraft[] | unknown[]; timelineInsights: TimelineInsightDraft[] | unknown[] }) {
  return [
    "Explain this Fluxpoint Aquarium Intelligence result using only the supplied deterministic evidence.",
    "Separate measured facts, deterministic interpretations, and uncertainty.",
    "Do not diagnose disease, claim laboratory certainty, invent missing records, or imply temporal correlation proves causation.",
    "Mention missing records when they limit confidence.",
    JSON.stringify(input, null, 2)
  ].join("\n\n");
}
