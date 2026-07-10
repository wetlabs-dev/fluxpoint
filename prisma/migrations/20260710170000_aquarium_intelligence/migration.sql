CREATE TYPE "AquariumIntelligenceAssessmentStatus" AS ENUM ('COMPLETE', 'PARTIAL', 'FAILED');
CREATE TYPE "AquariumHealthState" AS ENUM ('EXCELLENT', 'GOOD', 'WATCH', 'CONCERN', 'CRITICAL', 'INSUFFICIENT_DATA');
CREATE TYPE "AquariumIntelligenceConfidence" AS ENUM ('HIGH', 'MODERATE', 'LOW', 'INSUFFICIENT');
CREATE TYPE "AquariumIntelligenceActor" AS ENUM ('SYSTEM', 'USER', 'WORKER');
CREATE TYPE "AquariumParameterSourceType" AS ENUM ('MANUAL', 'SENSOR', 'MIXED');
CREATE TYPE "AquariumParameterTrendState" AS ENUM ('RISING', 'FALLING', 'STABLE', 'OSCILLATING', 'INSUFFICIENT_DATA');
CREATE TYPE "AquariumParameterStabilityState" AS ENUM ('STABLE', 'VARIABLE', 'UNSTABLE', 'INSUFFICIENT_DATA');
CREATE TYPE "AquariumParameterConcernState" AS ENUM ('NORMAL', 'WATCH', 'CONCERN', 'CRITICAL', 'UNKNOWN');
CREATE TYPE "AquariumTimelineInsightType" AS ENUM ('PRECEDING_CHANGE', 'COINCIDENT_CHANGE', 'RECURRING_PATTERN', 'CONDITION_CONTEXT', 'MORTALITY_CONTEXT', 'BREEDING_CONTEXT', 'MAINTENANCE_EFFECT', 'EQUIPMENT_EFFECT', 'PARAMETER_SHIFT', 'RECOVERY_PATTERN', 'OTHER');
CREATE TYPE "AquariumTimelineInsightStatus" AS ENUM ('ACTIVE', 'DISMISSED', 'ARCHIVED');
CREATE TYPE "AquariumTimelineInsightGenerator" AS ENUM ('DETERMINISTIC', 'EDDY_ASSISTED');

CREATE TABLE "AquariumHealthAssessment" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "aquariumId" TEXT NOT NULL,
  "status" "AquariumIntelligenceAssessmentStatus" NOT NULL DEFAULT 'COMPLETE',
  "healthState" "AquariumHealthState" NOT NULL,
  "internalScore" DOUBLE PRECISION,
  "confidence" "AquariumIntelligenceConfidence" NOT NULL,
  "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assessmentWindowStart" TIMESTAMP(3) NOT NULL,
  "assessmentWindowEnd" TIMESTAMP(3) NOT NULL,
  "summary" TEXT,
  "dataCoverage" JSONB NOT NULL,
  "domainResults" JSONB NOT NULL,
  "factorResults" JSONB NOT NULL,
  "recommendationResults" JSONB,
  "inputFingerprint" TEXT NOT NULL,
  "engineVersion" TEXT NOT NULL,
  "createdBy" "AquariumIntelligenceActor" NOT NULL DEFAULT 'SYSTEM',
  "requestedByUserId" TEXT,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AquariumHealthAssessment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AquariumParameterAnalysis" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "aquariumId" TEXT NOT NULL,
  "metricKey" TEXT NOT NULL,
  "unit" TEXT NOT NULL,
  "analysisWindowStart" TIMESTAMP(3) NOT NULL,
  "analysisWindowEnd" TIMESTAMP(3) NOT NULL,
  "observationCount" INTEGER NOT NULL,
  "sourceType" "AquariumParameterSourceType" NOT NULL,
  "currentValue" DOUBLE PRECISION,
  "baselineValue" DOUBLE PRECISION,
  "mean" DOUBLE PRECISION,
  "median" DOUBLE PRECISION,
  "min" DOUBLE PRECISION,
  "max" DOUBLE PRECISION,
  "standardDeviation" DOUBLE PRECISION,
  "slopePerDay" DOUBLE PRECISION,
  "relativeChange" DOUBLE PRECISION,
  "variabilityCoefficient" DOUBLE PRECISION,
  "thresholdCrossingCount" INTEGER NOT NULL DEFAULT 0,
  "trendState" "AquariumParameterTrendState" NOT NULL,
  "stabilityState" "AquariumParameterStabilityState" NOT NULL,
  "concernState" "AquariumParameterConcernState" NOT NULL,
  "interpretation" TEXT NOT NULL,
  "evidence" JSONB,
  "inputFingerprint" TEXT NOT NULL,
  "engineVersion" TEXT NOT NULL,
  "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AquariumParameterAnalysis_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AquariumTimelineInsight" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "aquariumId" TEXT NOT NULL,
  "insightType" "AquariumTimelineInsightType" NOT NULL,
  "targetEntityType" TEXT,
  "targetEntityId" TEXT,
  "targetEventAt" TIMESTAMP(3),
  "analysisWindowStart" TIMESTAMP(3) NOT NULL,
  "analysisWindowEnd" TIMESTAMP(3) NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "evidence" JSONB NOT NULL,
  "caveats" JSONB NOT NULL,
  "confidence" "AquariumIntelligenceConfidence" NOT NULL,
  "status" "AquariumTimelineInsightStatus" NOT NULL DEFAULT 'ACTIVE',
  "generatedBy" "AquariumTimelineInsightGenerator" NOT NULL DEFAULT 'DETERMINISTIC',
  "inputFingerprint" TEXT NOT NULL,
  "engineVersion" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AquariumTimelineInsight_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AquariumHealthAssessment_collectionId_assessedAt_idx" ON "AquariumHealthAssessment"("collectionId", "assessedAt");
CREATE INDEX "AquariumHealthAssessment_aquariumId_assessedAt_idx" ON "AquariumHealthAssessment"("aquariumId", "assessedAt");
CREATE INDEX "AquariumHealthAssessment_collectionId_healthState_assessedAt_idx" ON "AquariumHealthAssessment"("collectionId", "healthState", "assessedAt");
CREATE INDEX "AquariumHealthAssessment_collectionId_confidence_assessedAt_idx" ON "AquariumHealthAssessment"("collectionId", "confidence", "assessedAt");
CREATE UNIQUE INDEX "AquariumHealthAssessment_aquariumId_inputFingerprint_engineVersion_key" ON "AquariumHealthAssessment"("aquariumId", "inputFingerprint", "engineVersion");

CREATE INDEX "AquariumParameterAnalysis_collectionId_aquariumId_analyzedAt_idx" ON "AquariumParameterAnalysis"("collectionId", "aquariumId", "analyzedAt");
CREATE INDEX "AquariumParameterAnalysis_aquariumId_metricKey_analyzedAt_idx" ON "AquariumParameterAnalysis"("aquariumId", "metricKey", "analyzedAt");
CREATE INDEX "AquariumParameterAnalysis_collectionId_concernState_analyzedAt_idx" ON "AquariumParameterAnalysis"("collectionId", "concernState", "analyzedAt");
CREATE UNIQUE INDEX "AquariumParameterAnalysis_aquariumId_metricKey_inputFingerprint_engineVersion_key" ON "AquariumParameterAnalysis"("aquariumId", "metricKey", "inputFingerprint", "engineVersion");

CREATE INDEX "AquariumTimelineInsight_collectionId_status_createdAt_idx" ON "AquariumTimelineInsight"("collectionId", "status", "createdAt");
CREATE INDEX "AquariumTimelineInsight_aquariumId_status_createdAt_idx" ON "AquariumTimelineInsight"("aquariumId", "status", "createdAt");
CREATE INDEX "AquariumTimelineInsight_targetEntityType_targetEntityId_idx" ON "AquariumTimelineInsight"("targetEntityType", "targetEntityId");
CREATE UNIQUE INDEX "AquariumTimelineInsight_aquariumId_insightType_inputFingerprint_engineVersion_key" ON "AquariumTimelineInsight"("aquariumId", "insightType", "inputFingerprint", "engineVersion");

ALTER TABLE "AquariumHealthAssessment" ADD CONSTRAINT "AquariumHealthAssessment_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AquariumHealthAssessment" ADD CONSTRAINT "AquariumHealthAssessment_aquariumId_fkey" FOREIGN KEY ("aquariumId") REFERENCES "Aquarium"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AquariumHealthAssessment" ADD CONSTRAINT "AquariumHealthAssessment_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AquariumParameterAnalysis" ADD CONSTRAINT "AquariumParameterAnalysis_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AquariumParameterAnalysis" ADD CONSTRAINT "AquariumParameterAnalysis_aquariumId_fkey" FOREIGN KEY ("aquariumId") REFERENCES "Aquarium"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AquariumTimelineInsight" ADD CONSTRAINT "AquariumTimelineInsight_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AquariumTimelineInsight" ADD CONSTRAINT "AquariumTimelineInsight_aquariumId_fkey" FOREIGN KEY ("aquariumId") REFERENCES "Aquarium"("id") ON DELETE CASCADE ON UPDATE CASCADE;
