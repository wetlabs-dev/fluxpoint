import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { AssessmentDraft, ParameterAnalysisDraft, TimelineInsightDraft } from "@/domains/aquarium-intelligence/types";

export async function saveAssessment(collectionId: string, aquariumId: string, draft: AssessmentDraft, createdBy: "SYSTEM" | "USER" | "WORKER", requestedByUserId?: string | null) {
  const existing = await prisma.aquariumHealthAssessment.findUnique({
    where: { aquariumId_inputFingerprint_engineVersion: { aquariumId, inputFingerprint: draft.inputFingerprint, engineVersion: draft.engineVersion } }
  });
  if (existing) return { assessment: existing, created: false };
  const assessment = await prisma.aquariumHealthAssessment.create({
    data: {
      collectionId,
      aquariumId,
      status: draft.status,
      healthState: draft.healthState,
      internalScore: draft.internalScore,
      confidence: draft.confidence,
      assessedAt: draft.assessedAt,
      assessmentWindowStart: draft.assessmentWindowStart,
      assessmentWindowEnd: draft.assessmentWindowEnd,
      summary: draft.summary,
      dataCoverage: draft.dataCoverage as unknown as Prisma.InputJsonValue,
      domainResults: draft.domainResults as unknown as Prisma.InputJsonValue,
      factorResults: draft.factorResults as unknown as Prisma.InputJsonValue,
      recommendationResults: draft.recommendationResults as unknown as Prisma.InputJsonValue,
      inputFingerprint: draft.inputFingerprint,
      engineVersion: draft.engineVersion,
      createdBy,
      requestedByUserId: requestedByUserId ?? null,
      error: draft.error ?? null
    }
  });
  return { assessment, created: true };
}

export async function saveParameterAnalyses(collectionId: string, aquariumId: string, drafts: ParameterAnalysisDraft[]) {
  const saved = [];
  for (const draft of drafts) {
    const existing = await prisma.aquariumParameterAnalysis.findUnique({
      where: { aquariumId_metricKey_inputFingerprint_engineVersion: { aquariumId, metricKey: draft.metricKey, inputFingerprint: draft.inputFingerprint, engineVersion: draft.engineVersion } }
    });
    if (existing) {
      saved.push(existing);
      continue;
    }
    saved.push(await prisma.aquariumParameterAnalysis.create({
      data: {
        collectionId,
        aquariumId,
        metricKey: draft.metricKey,
        unit: draft.unit,
        analysisWindowStart: draft.analysisWindowStart,
        analysisWindowEnd: draft.analysisWindowEnd,
        observationCount: draft.observationCount,
        sourceType: draft.sourceType,
        currentValue: draft.currentValue,
        baselineValue: draft.baselineValue,
        mean: draft.mean,
        median: draft.median,
        min: draft.min,
        max: draft.max,
        standardDeviation: draft.standardDeviation,
        slopePerDay: draft.slopePerDay,
        relativeChange: draft.relativeChange,
        variabilityCoefficient: draft.variabilityCoefficient,
        thresholdCrossingCount: draft.thresholdCrossingCount,
        trendState: draft.trendState,
        stabilityState: draft.stabilityState,
        concernState: draft.concernState,
        interpretation: draft.interpretation,
        evidence: draft.evidence as unknown as Prisma.InputJsonValue,
        inputFingerprint: draft.inputFingerprint,
        engineVersion: draft.engineVersion,
        analyzedAt: new Date()
      }
    }));
  }
  return saved;
}

export async function saveTimelineInsights(collectionId: string, aquariumId: string, drafts: TimelineInsightDraft[]) {
  const saved = [];
  for (const draft of drafts) {
    const existing = await prisma.aquariumTimelineInsight.findUnique({
      where: { aquariumId_insightType_inputFingerprint_engineVersion: { aquariumId, insightType: draft.insightType, inputFingerprint: draft.inputFingerprint, engineVersion: draft.engineVersion } }
    });
    if (existing) {
      saved.push(existing);
      continue;
    }
    saved.push(await prisma.aquariumTimelineInsight.create({
      data: {
        collectionId,
        aquariumId,
        insightType: draft.insightType,
        targetEntityType: draft.targetEntityType ?? null,
        targetEntityId: draft.targetEntityId ?? null,
        targetEventAt: draft.targetEventAt ?? null,
        analysisWindowStart: draft.analysisWindowStart,
        analysisWindowEnd: draft.analysisWindowEnd,
        title: draft.title,
        summary: draft.summary,
        evidence: draft.evidence as unknown as Prisma.InputJsonValue,
        caveats: draft.caveats as unknown as Prisma.InputJsonValue,
        confidence: draft.confidence,
        inputFingerprint: draft.inputFingerprint,
        engineVersion: draft.engineVersion
      }
    }));
  }
  return saved;
}
