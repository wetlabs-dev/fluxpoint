"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { requireCollectionRole, structuralRoles } from "@/domains/auth/permissions";
import { advisorParameterKeys, buildAquariumParameterAdvisorContext, parameterAdvisorDraftSchema, type AdvisorParameterKey } from "@/domains/aquariums/parameter-advisor";
import { legacySalinityForRange } from "@/domains/species/habitat";
import { syncAquariumMetricThresholds } from "@/domains/metrics/aquarium-thresholds";
import { auditCollectionAction } from "@/domains/audit/audit-service";

const limits: Partial<Record<AdvisorParameterKey, { min: number; max: number }>> = {
  temperature: { min: 32, max: 120 }, ph: { min: 0, max: 14 }, gh: { min: 0, max: 100 }, kh: { min: 0, max: 100 }, salinity: { min: 0, max: 100 }, tds: { min: 0, max: 5_000 }, nitrate: { min: 0, max: 500 }, ammonia: { min: 0, max: 0 }, nitrite: { min: 0, max: 0 }
};

function validatedRange(parameter: AdvisorParameterKey, min: number | null, max: number | null, target: number | null) {
  const limit = limits[parameter]!;
  if (min == null || max == null || !Number.isFinite(min) || !Number.isFinite(max) || min > max || min < limit.min || max > limit.max) throw new Error(`Eddy's ${parameter} suggestion is not safe to apply.`);
  if (target != null && (!Number.isFinite(target) || target < min || target > max)) throw new Error(`Eddy's ${parameter} target does not sit inside its suggested range.`);
  return { min, max, target: target ?? (min + max) / 2 };
}

export async function applyParameterAdvisorRecommendations(formData: FormData) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  await requireCollectionRole(collection.id, structuralRoles);
  const aquariumId = String(formData.get("aquariumId") || "");
  const requestLogId = String(formData.get("requestLogId") || "");
  const selected = [...new Set(formData.getAll("parameters").map(String).filter((value): value is AdvisorParameterKey => advisorParameterKeys.includes(value as AdvisorParameterKey)))];
  if (!aquariumId || !requestLogId || !selected.length) throw new Error("Select at least one safe recommendation to apply.");
  const [aquarium, log] = await Promise.all([
    prisma.aquarium.findFirst({ where: { id: aquariumId, collectionId: collection.id }, include: { profile: true } }),
    prisma.aiRequestLog.findFirst({ where: { id: requestLogId, aquariumId, collectionId: collection.id, userId: user.id, featureKey: "AQUARIUM_PARAMETER_ADVISOR", status: "SUCCEEDED" } })
  ]);
  if (!aquarium || !log?.output) throw new Error("This parameter review is no longer available.");
  const draft = parameterAdvisorDraftSchema.parse(log.output);
  const recommendations = draft.recommendations.filter((row) => selected.includes(row.parameter) && row.status === "ADJUST" && row.safeToApply);
  if (!recommendations.length) throw new Error("The selected recommendations are not eligible for one-click application.");
  const currentContext = await buildAquariumParameterAdvisorContext(aquarium.id, user.id, collection.id);
  for (const recommendation of recommendations) {
    if (["ammonia", "nitrite", "nitrate"].includes(recommendation.parameter)) continue;
    const overlap = currentContext.overlaps[recommendation.parameter];
    if (overlap.hasConflict || overlap.intersectionMin == null || overlap.intersectionMax == null || recommendation.suggestedMin == null || recommendation.suggestedMax == null || recommendation.suggestedMin < overlap.intersectionMin || recommendation.suggestedMax > overlap.intersectionMax) throw new Error(`Stocking data changed after this review. Ask Eddy to review ${recommendation.parameter} again before applying it.`);
  }

  const profileData: Record<string, number> = {};
  let salinity: { min: number; max: number } | null = null;
  let tds: { min: number; max: number } | null = null;
  const applied: Array<{ parameter: AdvisorParameterKey; before: string | null; after: string | null }> = [];
  for (const recommendation of recommendations) {
    const range = validatedRange(recommendation.parameter, recommendation.suggestedMin, recommendation.suggestedMax, recommendation.suggestedTargetValue);
    if (recommendation.parameter === "temperature") Object.assign(profileData, { targetTemperature: range.target, targetTemperatureMin: range.min, targetTemperatureMax: range.max });
    if (recommendation.parameter === "ph") Object.assign(profileData, { targetPh: range.target, targetPhMin: range.min, targetPhMax: range.max });
    if (recommendation.parameter === "gh") Object.assign(profileData, { targetGh: range.target, targetGhMin: range.min, targetGhMax: range.max });
    if (recommendation.parameter === "kh") Object.assign(profileData, { targetKh: range.target, targetKhMin: range.min, targetKhMax: range.max });
    if (recommendation.parameter === "nitrate") Object.assign(profileData, { targetNitrateMin: range.min, targetNitrateMax: range.max });
    if (recommendation.parameter === "ammonia") Object.assign(profileData, { targetAmmoniaMin: 0, targetAmmoniaMax: 0 });
    if (recommendation.parameter === "nitrite") Object.assign(profileData, { targetNitriteMin: 0, targetNitriteMax: 0 });
    if (recommendation.parameter === "salinity") salinity = { min: range.min, max: range.max };
    if (recommendation.parameter === "tds") tds = { min: range.min, max: range.max };
    applied.push({ parameter: recommendation.parameter, before: recommendation.currentRange, after: recommendation.suggestedRange });
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (salinity) await tx.aquarium.update({ where: { id: aquarium.id }, data: { targetSalinityMinPpt: salinity.min, targetSalinityMaxPpt: salinity.max, salinity: legacySalinityForRange(salinity.min, salinity.max) } });
    if (Object.keys(profileData).length) await tx.aquariumProfile.upsert({ where: { aquariumId: aquarium.id }, create: { aquariumId: aquarium.id, ...profileData }, update: profileData });
    await tx.aquariumEvent.create({ data: { collectionId: collection.id, aquariumId: aquarium.id, eventType: "PARAMETER_TARGETS_UPDATED", title: "Eddy parameter recommendations applied", summary: `${applied.map((row) => row.parameter).join(", ")} target${applied.length === 1 ? "" : "s"} updated after keeper review.`, notes: "Eddy advice was reviewed and explicitly applied; sensitive water chemistry should be adjusted gradually.", metadata: { requestLogId, changes: applied }, createdById: user.id } });
    return tx.aquarium.findUniqueOrThrow({ where: { id: aquarium.id }, include: { profile: true } });
  });

  const thresholdSync = await syncAquariumMetricThresholds(aquarium.id);
  if (tds) {
    const config = await prisma.aquariumMetricConfig.findFirst({ where: { aquariumId: aquarium.id, metricDefinition: { key: "tds_ppm" } } });
    if (!config) throw new Error("The TDS metric configuration is unavailable.");
    await prisma.aquariumMetricConfig.update({ where: { id: config.id }, data: { minValue: tds.min, maxValue: tds.max, thresholdOverride: true } });
  }
  await auditCollectionAction({ collectionId: collection.id, entityType: "Aquarium", entityId: aquarium.id, action: "EDDY_PARAMETER_RECOMMENDATION_APPLIED", summary: `Eddy parameter recommendations applied to ${aquarium.name}`, actorUserId: user.id, before: { targetSalinityMinPpt: aquarium.targetSalinityMinPpt, targetSalinityMaxPpt: aquarium.targetSalinityMaxPpt, profile: aquarium.profile }, after: { targetSalinityMinPpt: updated.targetSalinityMinPpt, targetSalinityMaxPpt: updated.targetSalinityMaxPpt, profile: updated.profile, tds }, metadata: { requestLogId, changes: applied } });
  await auditCollectionAction({ collectionId: collection.id, entityType: "AquariumMetricConfig", entityId: aquarium.id, action: "METRIC_THRESHOLDS_RECALCULATED", summary: `Metric thresholds recalculated after Eddy recommendations for ${aquarium.name}`, actorUserId: user.id, after: thresholdSync.derived, metadata: { requestLogId, updatedDerivedCount: thresholdSync.updatedDerivedCount, tdsOverrideApplied: Boolean(tds) } });
  revalidatePath(`/aquariums/${aquarium.id}`);
  revalidatePath("/metrics");
  return { applied: applied.map((row) => row.parameter), changes: applied };
}
