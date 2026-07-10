import type { AquariumIntelligenceContext } from "@/domains/aquarium-intelligence/context-builders";
import { buildNormalizedEventStream } from "@/domains/aquarium-intelligence/context-builders";
import { TIMELINE_INSIGHTS_ENGINE_VERSION } from "@/domains/aquarium-intelligence/thresholds";
import type { NormalizedTimelineEvent, TimelineInsightDraft } from "@/domains/aquarium-intelligence/types";
import { fingerprint } from "@/domains/aquarium-intelligence/serializers";

const targetTypes = new Set(["CONDITION_ACTIVE", "CONDITION_TREATING", "CONDITION_WORSENING", "DEATH", "LIVESTOCK_LOSS", "SPAWN", "CONDITION_WATCHING"]);

export function generateTimelineInsights(context: AquariumIntelligenceContext): TimelineInsightDraft[] {
  const events = buildNormalizedEventStream(context);
  const targets = events.filter((event) => targetTypes.has(event.eventType) || event.eventType.includes("CONDITION") || event.eventType.includes("LOSS")).slice(-8);
  const insights: TimelineInsightDraft[] = [];
  for (const target of targets) {
    const insight = precedingChangeInsight(events, target, context.windowStart);
    if (insight) insights.push(insight);
  }
  const recurring = recurringPatternInsight(events, context);
  if (recurring) insights.push(recurring);
  return insights.slice(0, 12);
}

export function investigateBefore(context: AquariumIntelligenceContext, targetEntityType: string, targetEntityId: string, lookbackDays = 30): TimelineInsightDraft | null {
  const events = buildNormalizedEventStream(context);
  const target = events.find((event) => event.entityType === targetEntityType && event.entityId === targetEntityId);
  if (!target) return null;
  return precedingChangeInsight(events, target, new Date(target.occurredAt.getTime() - lookbackDays * 86_400_000));
}

function precedingChangeInsight(events: NormalizedTimelineEvent[], target: NormalizedTimelineEvent, earliest: Date): TimelineInsightDraft | null {
  const candidates = events
    .filter((event) => event.entityId !== target.entityId && event.occurredAt < target.occurredAt && event.occurredAt >= earliest)
    .map((event) => ({ event, relevance: relevance(event, target) }))
    .filter((row) => row.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance || b.event.occurredAt.getTime() - a.event.occurredAt.getTime())
    .slice(0, 6);
  if (!candidates.length) return null;
  const evidence = candidates.map(({ event, relevance }) => ({ occurredAt: event.occurredAt.toISOString(), title: event.title, source: event.source, relevance, summary: event.summary }));
  return {
    insightType: target.eventType.includes("CONDITION") ? "CONDITION_CONTEXT" : target.eventType.includes("LOSS") || target.eventType === "DEATH" ? "MORTALITY_CONTEXT" : "PRECEDING_CHANGE",
    targetEntityType: target.entityType,
    targetEntityId: target.entityId,
    targetEventAt: target.occurredAt,
    analysisWindowStart: earliest,
    analysisWindowEnd: target.occurredAt,
    title: `Changes before ${target.title}`,
    summary: `${candidates.length} potentially relevant record${candidates.length === 1 ? "" : "s"} occurred before ${target.title}. These are temporal associations for review, not proof of cause.`,
    evidence,
    caveats: ["Temporal association does not establish causation.", "Missing measurements or unlogged maintenance may limit this review.", "Eddy may explain these records, but should not invent missing evidence."],
    confidence: candidates.length >= 4 ? "MODERATE" : "LOW",
    inputFingerprint: fingerprint({ target: [target.entityType, target.entityId, target.occurredAt], evidence, version: TIMELINE_INSIGHTS_ENGINE_VERSION }),
    engineVersion: TIMELINE_INSIGHTS_ENGINE_VERSION
  };
}

function recurringPatternInsight(events: NormalizedTimelineEvent[], context: AquariumIntelligenceContext): TimelineInsightDraft | null {
  const conditionEvents = events.filter((event) => event.entityType === "HealthCondition");
  if (conditionEvents.length < 2) return null;
  const titles = new Map<string, NormalizedTimelineEvent[]>();
  for (const event of conditionEvents) {
    const key = event.title.toLowerCase();
    titles.set(key, [...(titles.get(key) ?? []), event]);
  }
  const recurring = [...titles.values()].find((rows) => rows.length >= 2);
  if (!recurring) return null;
  const evidence = recurring.map((event) => ({ occurredAt: event.occurredAt.toISOString(), title: event.title, source: event.source, relevance: 70, summary: event.summary }));
  return {
    insightType: "RECURRING_PATTERN",
    analysisWindowStart: context.windowStart,
    analysisWindowEnd: context.windowEnd,
    title: `Recurring pattern: ${recurring[0].title}`,
    summary: `${recurring[0].title} appears more than once in the saved condition history. Review repeated context, but do not assume the same cause.`,
    evidence,
    caveats: ["Repeated records can reflect repeated observation of the same issue rather than a new cause.", "Use condition notes and water tests to separate recurrence from long duration."],
    confidence: "MODERATE",
    inputFingerprint: fingerprint({ recurring: evidence, version: TIMELINE_INSIGHTS_ENGINE_VERSION }),
    engineVersion: TIMELINE_INSIGHTS_ENGINE_VERSION
  };
}

function relevance(event: NormalizedTimelineEvent, target: NormalizedTimelineEvent) {
  const days = Math.abs(target.occurredAt.getTime() - event.occurredAt.getTime()) / 86_400_000;
  let score = days <= 1 ? 40 : days <= 7 ? 28 : days <= 30 ? 14 : 4;
  if (event.severity === "CRITICAL") score += 30;
  if (event.severity === "CONCERN") score += 20;
  if (/WATER_CHANGE|MAINTENANCE|EQUIPMENT|MEDICATION|LIVESTOCK_ADDITION|TRANSFER|WORKFLOW|PARAMETER|TEST_RESULT/.test(event.eventType)) score += 18;
  if (target.metadata?.relatedItemId && target.metadata.relatedItemId === event.metadata?.relatedItemId) score += 20;
  if (target.metadata?.relatedSpeciesId && target.metadata.relatedSpeciesId === event.metadata?.relatedSpeciesId) score += 20;
  return score;
}
