export const healthDomainKeys = ["waterQuality", "stocking", "maintenance", "workflows", "sensorStability", "conditions", "mortality"] as const;

export type HealthDomainKey = typeof healthDomainKeys[number];
export type HealthState = "EXCELLENT" | "GOOD" | "WATCH" | "CONCERN" | "CRITICAL" | "INSUFFICIENT_DATA";
export type IntelligenceConfidence = "HIGH" | "MODERATE" | "LOW" | "INSUFFICIENT";
export type FactorSeverity = "FAVORABLE" | "INFO" | "WATCH" | "CONCERN" | "CRITICAL";

export type HealthFactor = {
  domain: HealthDomainKey;
  severity: FactorSeverity;
  source: string;
  occurredAt?: string;
  window?: string;
  explanation: string;
  href?: string;
};

export type HealthDomainResult = {
  key: HealthDomainKey;
  label: string;
  state: HealthState;
  score: number | null;
  weight: number;
  confidence: IntelligenceConfidence;
  evidence: string[];
  favorableFactors: HealthFactor[];
  adverseFactors: HealthFactor[];
  missingData: string[];
  recommendedReviewItems: string[];
};

export type DataCoverage = {
  latestWaterTestAt: string | null;
  latestWaterTestAgeDays: number | null;
  readingCount30d: number;
  readingCount90d: number;
  sensorReadingCount7d: number;
  stockingAssessmentAt: string | null;
  stockingAssessmentStale: boolean;
  maintenanceRecords30d: number;
  overdueCareTasks: number;
  workflowRecords30d: number;
  activeConditionCount: number;
  recentMortalityCount30d: number;
  eventCount90d: number;
  missing: string[];
};

export type AssessmentDraft = {
  status: "COMPLETE" | "PARTIAL" | "FAILED";
  healthState: HealthState;
  internalScore: number | null;
  confidence: IntelligenceConfidence;
  assessedAt: Date;
  assessmentWindowStart: Date;
  assessmentWindowEnd: Date;
  summary: string;
  dataCoverage: DataCoverage;
  domainResults: Record<HealthDomainKey, HealthDomainResult>;
  factorResults: {
    favorable: HealthFactor[];
    attention: HealthFactor[];
    all: HealthFactor[];
  };
  recommendationResults: Array<{ domain: HealthDomainKey; text: string }>;
  inputFingerprint: string;
  engineVersion: string;
  error?: string | null;
};

export type ParameterObservation = {
  id: string;
  metricKey: string;
  parameter: string;
  value: number;
  unit: string;
  source: "MANUAL" | "SENSOR" | "PROMETHEUS" | "IMPORTED";
  measuredAt: Date;
};

export type ParameterAnalysisDraft = {
  metricKey: string;
  unit: string;
  analysisWindowStart: Date;
  analysisWindowEnd: Date;
  observationCount: number;
  sourceType: "MANUAL" | "SENSOR" | "MIXED";
  currentValue: number | null;
  baselineValue: number | null;
  mean: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  standardDeviation: number | null;
  slopePerDay: number | null;
  relativeChange: number | null;
  variabilityCoefficient: number | null;
  thresholdCrossingCount: number;
  trendState: "RISING" | "FALLING" | "STABLE" | "OSCILLATING" | "INSUFFICIENT_DATA";
  stabilityState: "STABLE" | "VARIABLE" | "UNSTABLE" | "INSUFFICIENT_DATA";
  concernState: "NORMAL" | "WATCH" | "CONCERN" | "CRITICAL" | "UNKNOWN";
  interpretation: string;
  evidence: {
    latestAt: string | null;
    targetMin: number | null;
    targetMax: number | null;
    excludedReadings: number;
    observations: Array<{ measuredAt: string; value: number; source: string }>;
    waterChangeMarkers: Array<{ occurredAt: string; title: string }>;
  };
  inputFingerprint: string;
  engineVersion: string;
};

export type NormalizedTimelineEvent = {
  eventType: string;
  occurredAt: Date;
  aquariumId: string;
  entityType: string;
  entityId: string;
  title: string;
  summary: string | null;
  severity: "INFO" | "WATCH" | "CONCERN" | "CRITICAL";
  source: string;
  metadata?: Record<string, unknown>;
};

export type TimelineInsightDraft = {
  insightType: "PRECEDING_CHANGE" | "COINCIDENT_CHANGE" | "RECURRING_PATTERN" | "CONDITION_CONTEXT" | "MORTALITY_CONTEXT" | "BREEDING_CONTEXT" | "MAINTENANCE_EFFECT" | "EQUIPMENT_EFFECT" | "PARAMETER_SHIFT" | "RECOVERY_PATTERN" | "OTHER";
  targetEntityType?: string | null;
  targetEntityId?: string | null;
  targetEventAt?: Date | null;
  analysisWindowStart: Date;
  analysisWindowEnd: Date;
  title: string;
  summary: string;
  evidence: Array<{ occurredAt: string; title: string; source: string; relevance: number; summary?: string | null }>;
  caveats: string[];
  confidence: Exclude<IntelligenceConfidence, "INSUFFICIENT">;
  inputFingerprint: string;
  engineVersion: string;
};
