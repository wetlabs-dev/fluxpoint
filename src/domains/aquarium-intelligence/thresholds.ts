import type { HealthDomainKey } from "@/domains/aquarium-intelligence/types";

export const AQUARIUM_HEALTH_ENGINE_VERSION = "aquarium-health-v1";
export const PARAMETER_ANALYSIS_ENGINE_VERSION = "parameter-analysis-v1";
export const TIMELINE_INSIGHTS_ENGINE_VERSION = "timeline-insights-v1";

export const assessmentWindowDays = 90;

export const domainWeights: Record<HealthDomainKey, number> = {
  waterQuality: 24,
  stocking: 15,
  maintenance: 12,
  workflows: 8,
  sensorStability: 16,
  conditions: 17,
  mortality: 18
};

export const metricAnalysisConfig: Record<string, {
  label: string;
  unit: string;
  minObservations: number;
  minSpanDays: number;
  driftPerDay: number;
  unstableStdDev: number;
  variableStdDev: number;
  dangerousMin?: number;
  dangerousMax?: number;
  impossibleMin?: number;
  impossibleMax?: number;
}> = {
  temperature: { label: "Temperature", unit: "F", minObservations: 4, minSpanDays: 2, driftPerDay: 0.35, unstableStdDev: 2.2, variableStdDev: 1.1, dangerousMin: 65, dangerousMax: 86, impossibleMin: 30, impossibleMax: 110 },
  ph: { label: "pH", unit: "pH", minObservations: 4, minSpanDays: 2, driftPerDay: 0.08, unstableStdDev: 0.45, variableStdDev: 0.25, dangerousMin: 5.5, dangerousMax: 8.8, impossibleMin: 0, impossibleMax: 14 },
  ammonia: { label: "Ammonia", unit: "ppm", minObservations: 3, minSpanDays: 2, driftPerDay: 0.03, unstableStdDev: 0.2, variableStdDev: 0.1, dangerousMax: 0.5, impossibleMin: 0, impossibleMax: 20 },
  nitrite: { label: "Nitrite", unit: "ppm", minObservations: 3, minSpanDays: 2, driftPerDay: 0.03, unstableStdDev: 0.2, variableStdDev: 0.1, dangerousMax: 0.5, impossibleMin: 0, impossibleMax: 20 },
  nitrate: { label: "Nitrate", unit: "ppm", minObservations: 3, minSpanDays: 6, driftPerDay: 0.65, unstableStdDev: 12, variableStdDev: 6, dangerousMax: 80, impossibleMin: 0, impossibleMax: 300 },
  gh: { label: "GH", unit: "dGH", minObservations: 3, minSpanDays: 14, driftPerDay: 0.08, unstableStdDev: 3, variableStdDev: 1.5, impossibleMin: 0, impossibleMax: 80 },
  kh: { label: "KH", unit: "dKH", minObservations: 3, minSpanDays: 14, driftPerDay: 0.04, unstableStdDev: 2, variableStdDev: 1, impossibleMin: 0, impossibleMax: 80 },
  tds: { label: "TDS", unit: "ppm", minObservations: 3, minSpanDays: 6, driftPerDay: 4, unstableStdDev: 80, variableStdDev: 35, impossibleMin: 0, impossibleMax: 5000 },
  salinity: { label: "Salinity", unit: "ppt", minObservations: 3, minSpanDays: 6, driftPerDay: 0.25, unstableStdDev: 2.5, variableStdDev: 1.1, impossibleMin: 0, impossibleMax: 80 },
  turbidity: { label: "Turbidity", unit: "NTU", minObservations: 4, minSpanDays: 2, driftPerDay: 0.4, unstableStdDev: 4, variableStdDev: 2, impossibleMin: 0, impossibleMax: 1000 },
  co2: { label: "CO2", unit: "ppm", minObservations: 4, minSpanDays: 2, driftPerDay: 1.5, unstableStdDev: 12, variableStdDev: 6, impossibleMin: 0, impossibleMax: 200 },
  light: { label: "Light", unit: "PAR", minObservations: 5, minSpanDays: 2, driftPerDay: 10, unstableStdDev: 120, variableStdDev: 60, impossibleMin: 0, impossibleMax: 3000 },
  waterLevel: { label: "Water level", unit: "in", minObservations: 4, minSpanDays: 2, driftPerDay: 0.18, unstableStdDev: 1.4, variableStdDev: 0.7 }
};

export const parameterToMetricKey: Record<string, string> = {
  TEMPERATURE: "temperature",
  PH: "ph",
  AMMONIA: "ammonia",
  NITRITE: "nitrite",
  NITRATE: "nitrate",
  GH: "gh",
  KH: "kh",
  TDS: "tds",
  SALINITY: "salinity",
  TURBIDITY: "turbidity",
  CO2: "co2",
  LIGHT: "light",
  WATER_LEVEL: "waterLevel"
};
