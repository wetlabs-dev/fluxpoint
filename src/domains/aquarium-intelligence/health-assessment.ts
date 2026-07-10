import { subDays } from "date-fns";
import type { AquariumIntelligenceContext } from "@/domains/aquarium-intelligence/context-builders";
import { analyzeParameters } from "@/domains/aquarium-intelligence/parameter-analysis";
import { AQUARIUM_HEALTH_ENGINE_VERSION, assessmentWindowDays, domainWeights } from "@/domains/aquarium-intelligence/thresholds";
import type { AssessmentDraft, DataCoverage, HealthDomainKey, HealthDomainResult, HealthState, IntelligenceConfidence } from "@/domains/aquarium-intelligence/types";
import { assessConditions, assessMaintenance, assessMortality, assessSensorStability, assessStocking, assessWaterQuality, assessWorkflows, scoreForState } from "@/domains/aquarium-intelligence/health-factors";
import { fingerprint } from "@/domains/aquarium-intelligence/serializers";

export function buildHealthAssessment(context: AquariumIntelligenceContext): AssessmentDraft {
  const analyses = analyzeParameters(context);
  const domainResults = {
    waterQuality: assessWaterQuality(context, analyses),
    stocking: assessStocking(context),
    maintenance: assessMaintenance(context),
    workflows: assessWorkflows(context),
    sensorStability: assessSensorStability(analyses),
    conditions: assessConditions(context),
    mortality: assessMortality(context)
  } satisfies Record<HealthDomainKey, HealthDomainResult>;
  const dataCoverage = buildDataCoverage(context);
  const confidence = overallConfidence(dataCoverage, Object.values(domainResults));
  const healthState = overallState(domainResults, confidence);
  const allFactors = Object.values(domainResults).flatMap((domain) => [...domain.favorableFactors, ...domain.adverseFactors]);
  const attention = Object.values(domainResults).flatMap((domain) => domain.adverseFactors).sort((a, b) => severityRank(b.severity) - severityRank(a.severity)).slice(0, 8);
  const favorable = Object.values(domainResults).flatMap((domain) => domain.favorableFactors).slice(0, 6);
  const recommendations = Object.values(domainResults).flatMap((domain) => domain.recommendedReviewItems.map((text) => ({ domain: domain.key, text }))).concat(attention.slice(0, 4).map((factor) => ({ domain: factor.domain, text: factor.explanation })));
  const internalScore = weightedScore(domainResults);
  return {
    status: "COMPLETE",
    healthState,
    internalScore,
    confidence,
    assessedAt: context.windowEnd,
    assessmentWindowStart: subDays(context.windowEnd, assessmentWindowDays),
    assessmentWindowEnd: context.windowEnd,
    summary: summaryFor(healthState, confidence, attention, dataCoverage),
    dataCoverage,
    domainResults,
    factorResults: { favorable, attention, all: allFactors },
    recommendationResults: recommendations.slice(0, 8),
    inputFingerprint: fingerprint({
      aquariumId: context.aquarium.id,
      updatedAt: context.aquarium.updatedAt,
      readings: context.aquarium.readings.map((reading) => [reading.id, reading.value, reading.unit, reading.source, reading.measuredAt]),
      events: context.aquarium.events.map((event) => [event.id, event.eventType, event.eventDate, event.updatedAt]),
      careTasks: context.aquarium.careTasks.map((task) => [task.id, task.status, task.dueAt, task.updatedAt]),
      workflows: context.aquarium.workflowRuns.map((run) => [run.id, run.status, run.completedAt, run.cancelledAt]),
      conditions: context.aquarium.healthConditions.map((condition) => [condition.id, condition.status, condition.severity, condition.updatedAt]),
      stocking: context.aquarium.stockingPressureEstimates[0]?.inputFingerprint ?? null,
      version: AQUARIUM_HEALTH_ENGINE_VERSION
    }),
    engineVersion: AQUARIUM_HEALTH_ENGINE_VERSION
  };
}

function buildDataCoverage(context: AquariumIntelligenceContext): DataCoverage {
  const latestReading = context.aquarium.readings.at(-1);
  const now = context.windowEnd;
  const latestWaterTestAgeDays = latestReading ? Math.round((now.getTime() - latestReading.measuredAt.getTime()) / 86_400_000) : null;
  const readingCount30d = context.aquarium.readings.filter((reading) => reading.measuredAt >= new Date(now.getTime() - 30 * 86_400_000)).length;
  const sensorReadingCount7d = context.aquarium.readings.filter((reading) => ["SENSOR", "PROMETHEUS"].includes(reading.source) && reading.measuredAt >= new Date(now.getTime() - 7 * 86_400_000)).length;
  const latestStocking = context.aquarium.stockingPressureEstimates[0];
  const missing: string[] = [];
  if (!latestReading) missing.push("recent water readings");
  if (!latestStocking) missing.push("Stocking Pressure assessment");
  if (!context.aquarium.events.length) missing.push("timeline history");
  return {
    latestWaterTestAt: latestReading?.measuredAt.toISOString() ?? null,
    latestWaterTestAgeDays,
    readingCount30d,
    readingCount90d: context.aquarium.readings.length,
    sensorReadingCount7d,
    stockingAssessmentAt: latestStocking?.createdAt.toISOString() ?? null,
    stockingAssessmentStale: latestStocking ? (now.getTime() - latestStocking.createdAt.getTime()) / 86_400_000 > 30 : true,
    maintenanceRecords30d: context.aquarium.events.filter((event) => ["MAINTENANCE", "WATER_CHANGE", "EQUIPMENT_MAINTENANCE"].includes(event.eventType) && event.eventDate >= new Date(now.getTime() - 30 * 86_400_000)).length,
    overdueCareTasks: context.aquarium.careTasks.filter((task) => task.status === "PENDING" && task.dueAt && task.dueAt < now).length,
    workflowRecords30d: context.aquarium.workflowRuns.length,
    activeConditionCount: context.aquarium.healthConditions.filter((condition) => ["WATCHING", "ACTIVE", "TREATING", "IMPROVING", "WORSENING"].includes(condition.status)).length,
    recentMortalityCount30d: context.aquarium.events.filter((event) => ["DEATH", "LIVESTOCK_LOSS"].includes(event.eventType) && event.eventDate >= new Date(now.getTime() - 30 * 86_400_000)).length,
    eventCount90d: context.aquarium.events.length,
    missing
  };
}

function overallState(domains: Record<HealthDomainKey, HealthDomainResult>, confidence: IntelligenceConfidence): HealthState {
  const values = Object.values(domains);
  if (confidence === "INSUFFICIENT") return "INSUFFICIENT_DATA";
  if (domains.waterQuality.state === "CRITICAL" || domains.conditions.state === "CRITICAL") return "CRITICAL";
  if (values.some((domain) => domain.state === "CRITICAL")) return "CONCERN";
  if (domains.waterQuality.state === "CONCERN" || domains.conditions.state === "CONCERN" || domains.mortality.state === "CONCERN") return "CONCERN";
  if (values.filter((domain) => domain.state === "WATCH" || domain.state === "CONCERN").length >= 2) return "WATCH";
  if (values.every((domain) => ["GOOD", "EXCELLENT", "INSUFFICIENT_DATA"].includes(domain.state)) && confidence === "HIGH") return "EXCELLENT";
  return "GOOD";
}

function weightedScore(domains: Record<HealthDomainKey, HealthDomainResult>) {
  let totalWeight = 0;
  let total = 0;
  for (const domain of Object.values(domains)) {
    if (domain.score == null) continue;
    const weight = domainWeights[domain.key];
    total += domain.score * weight;
    totalWeight += weight;
  }
  return totalWeight ? Math.round((total / totalWeight) * 10) / 10 : null;
}

function overallConfidence(dataCoverage: DataCoverage, domains: HealthDomainResult[]): IntelligenceConfidence {
  const sufficientDomains = domains.filter((domain) => domain.state !== "INSUFFICIENT_DATA").length;
  if (sufficientDomains < 3 || dataCoverage.readingCount90d === 0 && dataCoverage.eventCount90d === 0) return "INSUFFICIENT";
  if (dataCoverage.readingCount30d >= 6 && dataCoverage.stockingAssessmentAt && dataCoverage.eventCount90d >= 4) return "HIGH";
  if (dataCoverage.readingCount90d >= 3 || dataCoverage.stockingAssessmentAt || dataCoverage.eventCount90d >= 3) return "MODERATE";
  return "LOW";
}

function summaryFor(state: HealthState, confidence: IntelligenceConfidence, attention: Array<{ explanation: string }>, dataCoverage: DataCoverage) {
  if (state === "INSUFFICIENT_DATA") return "Not enough recent aquarium records are available to assess health reliably.";
  const label = state === "EXCELLENT" ? "Excellent" : state === "GOOD" ? "Good" : state === "WATCH" ? "Needs watching" : state === "CONCERN" ? "Concerning" : "Critical";
  const lead = `${label} with ${confidence.toLowerCase()} confidence.`;
  const detail = attention[0]?.explanation ?? "No high-priority adverse factors were found in the current evidence window.";
  const missing = dataCoverage.missing.length ? ` Missing context: ${dataCoverage.missing.join(", ")}.` : "";
  return `${lead} ${detail}${missing}`;
}

function severityRank(severity: string) {
  return severity === "CRITICAL" ? 4 : severity === "CONCERN" ? 3 : severity === "WATCH" ? 2 : severity === "INFO" ? 1 : 0;
}

export { scoreForState };
