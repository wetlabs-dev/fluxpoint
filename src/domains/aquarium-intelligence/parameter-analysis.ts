import type { AquariumIntelligenceContext } from "@/domains/aquarium-intelligence/context-builders";
import { parameterObservationsFromContext } from "@/domains/aquarium-intelligence/context-builders";
import { metricAnalysisConfig } from "@/domains/aquarium-intelligence/thresholds";
import type { ParameterAnalysisDraft, ParameterObservation } from "@/domains/aquarium-intelligence/types";
import { daysBetween, fingerprint, formatApprox } from "@/domains/aquarium-intelligence/serializers";

const targetByMetric: Record<string, { min?: string; max?: string }> = {
  temperature: { min: "targetTemperatureMin", max: "targetTemperatureMax" },
  ph: { min: "targetPhMin", max: "targetPhMax" },
  ammonia: { min: "targetAmmoniaMin", max: "targetAmmoniaMax" },
  nitrite: { min: "targetNitriteMin", max: "targetNitriteMax" },
  nitrate: { min: "targetNitrateMin", max: "targetNitrateMax" },
  gh: { min: "targetGhMin", max: "targetGhMax" },
  kh: { min: "targetKhMin", max: "targetKhMax" },
  salinity: { min: "targetSalinityMinPpt", max: "targetSalinityMaxPpt" }
};

export function analyzeParameters(context: AquariumIntelligenceContext): ParameterAnalysisDraft[] {
  const grouped = new Map<string, ParameterObservation[]>();
  for (const observation of parameterObservationsFromContext(context)) {
    const group = grouped.get(observation.metricKey) ?? [];
    group.push(observation);
    grouped.set(observation.metricKey, group);
  }
  return [...grouped.entries()]
    .map(([metricKey, observations]) => analyzeMetric(context, metricKey, observations))
    .sort((a, b) => concernRank(b.concernState) - concernRank(a.concernState) || a.metricKey.localeCompare(b.metricKey));
}

export function analyzeMetric(context: AquariumIntelligenceContext, metricKey: string, observations: ParameterObservation[]): ParameterAnalysisDraft {
  const config = metricAnalysisConfig[metricKey] ?? { label: metricKey, unit: observations[0]?.unit ?? "", minObservations: 3, minSpanDays: 6, driftPerDay: 1, unstableStdDev: 10, variableStdDev: 5 };
  const target = targetRange(context, metricKey);
  const excluded = observations.filter((observation) => isImpossible(observation.value, config)).length;
  const valid = observations.filter((observation) => !isImpossible(observation.value, config)).sort((a, b) => a.measuredAt.getTime() - b.measuredAt.getTime());
  const values = valid.map((row) => row.value);
  const first = valid[0] ?? null;
  const latest = valid[valid.length - 1] ?? null;
  const spanDays = first && latest ? Math.max(0, daysBetween(first.measuredAt, latest.measuredAt)) : 0;
  const stats = calculateStats(values);
  const slope = valid.length >= 2 ? linearRegressionSlopePerDay(valid) : null;
  const relativeChange = stats.median && latest ? (latest.value - stats.median) / Math.abs(stats.median || 1) : null;
  const thresholdCrossingCount = countThresholdCrossings(valid, target.min, target.max);
  const sourceType = sourceTypeFor(valid);
  const sufficient = valid.length >= config.minObservations && spanDays >= config.minSpanDays;
  const stabilityState = sufficient ? stabilityFor(stats.standardDeviation, thresholdCrossingCount, config) : "INSUFFICIENT_DATA";
  const trendState = sufficient ? trendFor(slope, config, stabilityState) : "INSUFFICIENT_DATA";
  const concernState = concernFor({ latest: latest?.value ?? null, targetMin: target.min, targetMax: target.max, trendState, stabilityState, thresholdCrossingCount, config });
  const interpretation = interpretationFor({ config, metricKey, valid, spanDays, trendState, stabilityState, concernState, slope, latest: latest?.value ?? null, target });
  const waterChangeMarkers = context.aquarium.waterChangeEvents.map((event) => ({ occurredAt: event.aquariumEvent.eventDate.toISOString(), title: event.aquariumEvent.title }));
  return {
    metricKey,
    unit: latest?.unit ?? config.unit,
    analysisWindowStart: context.windowStart,
    analysisWindowEnd: context.windowEnd,
    observationCount: valid.length,
    sourceType,
    currentValue: latest?.value ?? null,
    baselineValue: stats.median,
    mean: stats.mean,
    median: stats.median,
    min: stats.min,
    max: stats.max,
    standardDeviation: stats.standardDeviation,
    slopePerDay: slope,
    relativeChange,
    variabilityCoefficient: stats.mean ? stats.standardDeviation / Math.abs(stats.mean) : null,
    thresholdCrossingCount,
    trendState,
    stabilityState,
    concernState,
    interpretation,
    evidence: { latestAt: latest?.measuredAt.toISOString() ?? null, targetMin: target.min, targetMax: target.max, excludedReadings: excluded, waterChangeMarkers },
    inputFingerprint: fingerprint({ metricKey, valid: valid.map((row) => [row.id, row.value, row.unit, row.source, row.measuredAt]), target, configVersion: 1, waterChangeMarkers }),
    engineVersion: "parameter-analysis-v1"
  };
}

function calculateStats(values: number[]) {
  if (!values.length) return { mean: null, median: null, min: null, max: null, standardDeviation: null };
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const median = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return { mean, median, min: sorted[0], max: sorted[sorted.length - 1], standardDeviation: Math.sqrt(variance) };
}

function linearRegressionSlopePerDay(rows: ParameterObservation[]) {
  const x0 = rows[0].measuredAt.getTime();
  const points = rows.map((row) => ({ x: (row.measuredAt.getTime() - x0) / 86_400_000, y: row.value }));
  const xMean = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const yMean = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  const denominator = points.reduce((sum, point) => sum + (point.x - xMean) ** 2, 0);
  if (!denominator) return 0;
  return points.reduce((sum, point) => sum + (point.x - xMean) * (point.y - yMean), 0) / denominator;
}

function targetRange(context: AquariumIntelligenceContext, metricKey: string) {
  const map = targetByMetric[metricKey];
  const profile = context.aquarium.profile as Record<string, number | null> | null;
  const aquarium = context.aquarium as unknown as Record<string, number | null>;
  return {
    min: map?.min ? profile?.[map.min] ?? aquarium[map.min] ?? null : null,
    max: map?.max ? profile?.[map.max] ?? aquarium[map.max] ?? null : null
  };
}

function countThresholdCrossings(rows: ParameterObservation[], min: number | null, max: number | null) {
  if (min == null && max == null) return 0;
  let count = 0;
  let previousInside: boolean | null = null;
  for (const row of rows) {
    const inside = (min == null || row.value >= min) && (max == null || row.value <= max);
    if (previousInside !== null && previousInside !== inside) count += 1;
    previousInside = inside;
  }
  return count;
}

function isImpossible(value: number, config: { impossibleMin?: number; impossibleMax?: number }) {
  return (config.impossibleMin != null && value < config.impossibleMin) || (config.impossibleMax != null && value > config.impossibleMax);
}

function sourceTypeFor(rows: ParameterObservation[]): ParameterAnalysisDraft["sourceType"] {
  const hasManual = rows.some((row) => row.source === "MANUAL" || row.source === "IMPORTED");
  const hasSensor = rows.some((row) => row.source === "SENSOR" || row.source === "PROMETHEUS");
  return hasManual && hasSensor ? "MIXED" : hasSensor ? "SENSOR" : "MANUAL";
}

function stabilityFor(stdDev: number | null, crossings: number, config: { unstableStdDev: number; variableStdDev: number }): ParameterAnalysisDraft["stabilityState"] {
  if (stdDev == null) return "INSUFFICIENT_DATA";
  if (stdDev >= config.unstableStdDev || crossings >= 4) return "UNSTABLE";
  if (stdDev >= config.variableStdDev || crossings >= 2) return "VARIABLE";
  return "STABLE";
}

function trendFor(slope: number | null, config: { driftPerDay: number }, stabilityState: ParameterAnalysisDraft["stabilityState"]): ParameterAnalysisDraft["trendState"] {
  if (slope == null) return "INSUFFICIENT_DATA";
  if (stabilityState === "UNSTABLE") return "OSCILLATING";
  if (slope >= config.driftPerDay) return "RISING";
  if (slope <= -config.driftPerDay) return "FALLING";
  return "STABLE";
}

function concernFor(input: { latest: number | null; targetMin: number | null; targetMax: number | null; trendState: ParameterAnalysisDraft["trendState"]; stabilityState: ParameterAnalysisDraft["stabilityState"]; thresholdCrossingCount: number; config: { dangerousMin?: number; dangerousMax?: number } }): ParameterAnalysisDraft["concernState"] {
  if (input.latest == null || input.trendState === "INSUFFICIENT_DATA") return "UNKNOWN";
  if ((input.config.dangerousMin != null && input.latest < input.config.dangerousMin) || (input.config.dangerousMax != null && input.latest > input.config.dangerousMax)) return "CRITICAL";
  if ((input.targetMin != null && input.latest < input.targetMin) || (input.targetMax != null && input.latest > input.targetMax)) return "CONCERN";
  if (input.stabilityState === "UNSTABLE" || input.thresholdCrossingCount >= 3) return "CONCERN";
  if (input.trendState === "RISING" || input.trendState === "FALLING" || input.stabilityState === "VARIABLE") return "WATCH";
  return "NORMAL";
}

function interpretationFor(input: { config: { label: string; unit: string }; metricKey: string; valid: ParameterObservation[]; spanDays: number; trendState: ParameterAnalysisDraft["trendState"]; stabilityState: ParameterAnalysisDraft["stabilityState"]; concernState: ParameterAnalysisDraft["concernState"]; slope: number | null; latest: number | null; target: { min: number | null; max: number | null } }) {
  if (!input.valid.length) return `${input.config.label} has no recent usable observations.`;
  if (input.trendState === "INSUFFICIENT_DATA") return `${input.config.label} has ${input.valid.length} recent observation${input.valid.length === 1 ? "" : "s"} over ${formatApprox(input.spanDays, 0)} day${Math.round(input.spanDays) === 1 ? "" : "s"}, which is not enough to infer drift reliably.`;
  const targetText = input.target.min != null || input.target.max != null ? ` Target range: ${input.target.min ?? "?"}-${input.target.max ?? "?"} ${input.config.unit}.` : " No aquarium target range is saved, so interpretation is limited.";
  if (input.stabilityState === "UNSTABLE") return `${input.config.label} is unstable across the analysis window. Temporal association is worth reviewing, but this does not establish cause.${targetText}`;
  if (input.trendState === "RISING" || input.trendState === "FALLING") return `${input.config.label} has trended ${input.trendState.toLowerCase()} by about ${formatApprox(Math.abs(input.slope ?? 0), 2)} ${input.config.unit} per day over ${formatApprox(input.spanDays, 0)} days.${targetText}`;
  return `${input.config.label} appears stable across ${formatApprox(input.spanDays, 0)} days based on saved readings.${targetText}`;
}

export function concernRank(state: ParameterAnalysisDraft["concernState"]) {
  return state === "CRITICAL" ? 4 : state === "CONCERN" ? 3 : state === "WATCH" ? 2 : state === "NORMAL" ? 1 : 0;
}
