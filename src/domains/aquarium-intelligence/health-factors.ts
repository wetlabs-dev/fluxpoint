import type { AquariumIntelligenceContext } from "@/domains/aquarium-intelligence/context-builders";
import type { HealthDomainKey, HealthDomainResult, HealthFactor, HealthState, IntelligenceConfidence, ParameterAnalysisDraft } from "@/domains/aquarium-intelligence/types";
import { domainWeights } from "@/domains/aquarium-intelligence/thresholds";

const labels: Record<HealthDomainKey, string> = {
  waterQuality: "Water",
  stocking: "Stocking",
  maintenance: "Maintenance",
  workflows: "Workflows",
  sensorStability: "Stability",
  conditions: "Conditions",
  mortality: "Mortality"
};

export function domainResult(input: {
  key: HealthDomainKey;
  state: HealthState;
  score: number | null;
  confidence: IntelligenceConfidence;
  evidence?: string[];
  favorableFactors?: HealthFactor[];
  adverseFactors?: HealthFactor[];
  missingData?: string[];
  recommendedReviewItems?: string[];
}): HealthDomainResult {
  return {
    key: input.key,
    label: labels[input.key],
    state: input.state,
    score: input.score,
    weight: domainWeights[input.key],
    confidence: input.confidence,
    evidence: input.evidence ?? [],
    favorableFactors: input.favorableFactors ?? [],
    adverseFactors: input.adverseFactors ?? [],
    missingData: input.missingData ?? [],
    recommendedReviewItems: input.recommendedReviewItems ?? []
  };
}

export function factor(domain: HealthDomainKey, severity: HealthFactor["severity"], explanation: string, source: string, occurredAt?: Date | string | null): HealthFactor {
  return { domain, severity, explanation, source, occurredAt: occurredAt ? new Date(occurredAt).toISOString() : undefined };
}

export function assessWaterQuality(context: AquariumIntelligenceContext, analyses: ParameterAnalysisDraft[]) {
  const adverse = analyses.filter((analysis) => ["WATCH", "CONCERN", "CRITICAL"].includes(analysis.concernState)).map((analysis) => factor("waterQuality", analysis.concernState === "CRITICAL" ? "CRITICAL" : analysis.concernState === "CONCERN" ? "CONCERN" : "WATCH", analysis.interpretation, "parameter analysis", analysis.evidence.latestAt));
  const favorable = analyses.filter((analysis) => analysis.concernState === "NORMAL").slice(0, 4).map((analysis) => factor("waterQuality", "FAVORABLE", analysis.interpretation, "parameter analysis", analysis.evidence.latestAt));
  const nitrogenCritical = analyses.some((analysis) => ["ammonia", "nitrite"].includes(analysis.metricKey) && analysis.concernState === "CRITICAL");
  const readingCount = context.aquarium.readings.length;
  if (!readingCount) return domainResult({ key: "waterQuality", state: "INSUFFICIENT_DATA", score: null, confidence: "INSUFFICIENT", missingData: ["No recent water parameter readings are saved."], recommendedReviewItems: ["Add recent water tests or connect metric ingestion before relying on water-quality interpretation."] });
  const state = nitrogenCritical ? "CRITICAL" : adverse.some((row) => row.severity === "CONCERN") ? "CONCERN" : adverse.length ? "WATCH" : favorable.length >= 3 ? "GOOD" : "WATCH";
  const confidence = readingCount >= 8 ? "HIGH" : readingCount >= 4 ? "MODERATE" : "LOW";
  return domainResult({ key: "waterQuality", state, score: scoreForState(state), confidence, favorableFactors: favorable, adverseFactors: adverse, evidence: [`${readingCount} recent water reading${readingCount === 1 ? "" : "s"} reviewed.`], missingData: analyses.length < 3 ? ["Only a partial parameter set has recent readings."] : [] });
}

export function assessStocking(context: AquariumIntelligenceContext) {
  const latest = context.aquarium.stockingPressureEstimates[0];
  if (!latest) return domainResult({ key: "stocking", state: "INSUFFICIENT_DATA", score: null, confidence: "INSUFFICIENT", missingData: ["No Stocking Pressure estimate has been saved."], recommendedReviewItems: ["Run Stocking Pressure so health assessment can reuse that domain logic."] });
  const ageDays = Math.round((Date.now() - latest.createdAt.getTime()) / 86_400_000);
  const stale = ageDays > 30;
  const state = latest.level === "OVERSTOCKED" ? "CONCERN" : latest.level === "HEAVY" ? "WATCH" : latest.level === "UNKNOWN" ? "INSUFFICIENT_DATA" : stale ? "WATCH" : "GOOD";
  const severity = latest.level === "OVERSTOCKED" ? "CONCERN" : latest.level === "HEAVY" || stale ? "WATCH" : "FAVORABLE";
  return domainResult({
    key: "stocking",
    state,
    score: scoreForState(state),
    confidence: latest.confidence === "HIGH" && !stale ? "HIGH" : latest.confidence === "LOW" || stale ? "LOW" : "MODERATE",
    favorableFactors: severity === "FAVORABLE" ? [factor("stocking", "FAVORABLE", `Latest Stocking Pressure is ${latest.level.toLowerCase().replaceAll("_", " ")}.`, "Stocking Pressure", latest.createdAt)] : [],
    adverseFactors: severity !== "FAVORABLE" ? [factor("stocking", severity, stale ? "Stocking Pressure is older than 30 days or may need review after recent changes." : latest.summary, "Stocking Pressure", latest.createdAt)] : [],
    evidence: [latest.summary],
    missingData: latest.level === "UNKNOWN" ? ["Stocking Pressure could not resolve a useful level from saved records."] : []
  });
}

export function assessMaintenance(context: AquariumIntelligenceContext) {
  const now = context.windowEnd;
  const overdueEquipment = context.aquarium.equipmentAttachments.filter((attachment) => {
    const profile = attachment.item.equipmentProfile;
    if (!profile?.maintenanceIntervalDays || !profile.lastMaintainedAt) return profile?.equipmentType === "FILTER" || profile?.equipmentType === "HEATER";
    return profile.lastMaintainedAt.getTime() + profile.maintenanceIntervalDays * 86_400_000 < now.getTime();
  });
  const overdueCareTasks = context.aquarium.careTasks.filter((task) => task.status === "PENDING" && task.dueAt && task.dueAt < now);
  const recentMaintenance = context.aquarium.events.filter((event) => ["MAINTENANCE", "WATER_CHANGE", "EQUIPMENT_MAINTENANCE"].includes(event.eventType));
  const critical = overdueEquipment.filter((attachment) => ["FILTER", "HEATER", "AERATION"].includes(attachment.role)).length;
  const adverse = [
    ...overdueEquipment.slice(0, 3).map((attachment) => factor("maintenance", ["FILTER", "HEATER", "AERATION"].includes(attachment.role) ? "CONCERN" : "WATCH", `${attachment.item.name} maintenance needs review.`, "equipment", attachment.updatedAt)),
    ...overdueCareTasks.slice(0, 3).map((task) => factor("maintenance", "WATCH", `${task.title} is overdue.`, "care task", task.dueAt))
  ];
  const favorable = recentMaintenance.length ? [factor("maintenance", "FAVORABLE", `${recentMaintenance.length} maintenance or water-change event${recentMaintenance.length === 1 ? "" : "s"} logged in the assessment window.`, "timeline", recentMaintenance.at(-1)?.eventDate)] : [];
  const state = critical ? "CONCERN" : adverse.length ? "WATCH" : recentMaintenance.length ? "GOOD" : "WATCH";
  return domainResult({ key: "maintenance", state, score: scoreForState(state), confidence: "MODERATE", favorableFactors: favorable, adverseFactors: adverse, evidence: [`${recentMaintenance.length} maintenance events reviewed.`], missingData: recentMaintenance.length ? [] : ["No recent maintenance events are logged."] });
}

export function assessWorkflows(context: AquariumIntelligenceContext) {
  const activeRuns = context.aquarium.workflowRuns.filter((run) => ["RUNNING", "ACTIVE", "PAUSED"].includes(run.status));
  const overdueSteps = activeRuns.flatMap((run) => run.stepRuns.map((step) => ({ run, step }))).filter(({ step }) => step.status !== "COMPLETED" && step.dueAt && step.dueAt < context.windowEnd);
  const critical = overdueSteps.filter(({ run }) => ["MEDICATION", "QUARANTINE", "MAINTENANCE"].includes(run.workflowTemplate.category));
  const adverse = overdueSteps.slice(0, 4).map(({ run, step }) => factor("workflows", critical.some((row) => row.step.id === step.id) ? "CONCERN" : "WATCH", `${step.titleSnapshot ?? step.workflowStep.title} is overdue in ${run.title ?? run.workflowTemplate.name}.`, "workflow", step.dueAt));
  const state = critical.length ? "CONCERN" : overdueSteps.length ? "WATCH" : activeRuns.length ? "GOOD" : "GOOD";
  return domainResult({ key: "workflows", state, score: scoreForState(state), confidence: activeRuns.length ? "MODERATE" : "LOW", favorableFactors: adverse.length ? [] : [factor("workflows", "FAVORABLE", "No overdue active workflow steps were found.", "workflow")], adverseFactors: adverse, evidence: [`${activeRuns.length} active workflow run${activeRuns.length === 1 ? "" : "s"} reviewed.`] });
}

export function assessSensorStability(analyses: ParameterAnalysisDraft[]) {
  const stabilityAnalyses = analyses.filter((analysis) => analysis.sourceType !== "MANUAL");
  if (!stabilityAnalyses.length) return domainResult({ key: "sensorStability", state: "INSUFFICIENT_DATA", score: null, confidence: "INSUFFICIENT", missingData: ["No recent sensor-backed observations are available."], recommendedReviewItems: ["Use manual trend cards for now, or connect sensors for monitoring stability."] });
  const adverse = stabilityAnalyses.filter((analysis) => ["VARIABLE", "UNSTABLE"].includes(analysis.stabilityState)).map((analysis) => factor("sensorStability", analysis.stabilityState === "UNSTABLE" ? "CONCERN" : "WATCH", analysis.interpretation, "parameter analysis", analysis.evidence.latestAt));
  const state = adverse.some((row) => row.severity === "CONCERN") ? "CONCERN" : adverse.length ? "WATCH" : "GOOD";
  return domainResult({ key: "sensorStability", state, score: scoreForState(state), confidence: stabilityAnalyses.length >= 3 ? "HIGH" : "MODERATE", favorableFactors: adverse.length ? [] : [factor("sensorStability", "FAVORABLE", "Recent sensor-backed metrics appear stable.", "parameter analysis")], adverseFactors: adverse, evidence: [`${stabilityAnalyses.length} sensor-backed metric${stabilityAnalyses.length === 1 ? "" : "s"} reviewed.`] });
}

export function assessConditions(context: AquariumIntelligenceContext) {
  const active = context.aquarium.healthConditions.filter((condition) => ["WATCHING", "ACTIVE", "TREATING", "IMPROVING", "WORSENING"].includes(condition.status));
  const severe = active.filter((condition) => ["HIGH", "CRITICAL"].includes(condition.severity) || condition.status === "WORSENING");
  const adverse = active.slice(0, 4).map((condition) => factor("conditions", condition.severity === "CRITICAL" || condition.status === "WORSENING" ? "CRITICAL" : condition.severity === "HIGH" ? "CONCERN" : "WATCH", `${condition.title} is ${condition.status.toLowerCase()} (${condition.severity.toLowerCase()}).`, "condition", condition.lastObservedAt ?? condition.firstObservedAt));
  const state = severe.some((condition) => condition.severity === "CRITICAL" || condition.status === "WORSENING") ? "CRITICAL" : severe.length ? "CONCERN" : active.length ? "WATCH" : "GOOD";
  return domainResult({ key: "conditions", state, score: scoreForState(state), confidence: "HIGH", favorableFactors: active.length ? [] : [factor("conditions", "FAVORABLE", "No active health conditions are recorded.", "conditions")], adverseFactors: adverse, evidence: [`${active.length} active condition${active.length === 1 ? "" : "s"} reviewed.`] });
}

export function assessMortality(context: AquariumIntelligenceContext) {
  const losses = context.aquarium.events.filter((event) => ["DEATH", "LIVESTOCK_LOSS"].includes(event.eventType));
  const losses30 = losses.filter((event) => event.eventDate >= new Date(context.windowEnd.getTime() - 30 * 86_400_000));
  const cluster = losses30.length >= 3;
  const adverse = losses30.slice(0, 5).map((event) => factor("mortality", cluster ? "CONCERN" : "WATCH", `${event.title} occurred before or during the current assessment window; review related changes without assuming cause.`, "timeline", event.eventDate));
  const state = cluster ? "CONCERN" : losses30.length ? "WATCH" : "GOOD";
  return domainResult({ key: "mortality", state, score: scoreForState(state), confidence: "MODERATE", favorableFactors: losses30.length ? [] : [factor("mortality", "FAVORABLE", "No recent livestock loss events are logged.", "timeline")], adverseFactors: adverse, evidence: [`${losses30.length} recent loss event${losses30.length === 1 ? "" : "s"} reviewed.`] });
}

export function scoreForState(state: HealthState) {
  return state === "EXCELLENT" ? 95 : state === "GOOD" ? 82 : state === "WATCH" ? 62 : state === "CONCERN" ? 38 : state === "CRITICAL" ? 12 : null;
}
