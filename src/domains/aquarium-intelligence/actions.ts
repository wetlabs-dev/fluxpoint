"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { auditCollectionAction } from "@/domains/audit/audit-service";
import { buildAquariumIntelligenceContext } from "@/domains/aquarium-intelligence/context-builders";
import { buildHealthAssessment } from "@/domains/aquarium-intelligence/health-assessment";
import { analyzeParameters } from "@/domains/aquarium-intelligence/parameter-analysis";
import { generateTimelineInsights } from "@/domains/aquarium-intelligence/timeline-analysis";
import { saveAssessment, saveParameterAnalyses, saveTimelineInsights } from "@/domains/aquarium-intelligence/persistence";
import { canRefreshAquariumIntelligence } from "@/domains/aquarium-intelligence/permissions";

export async function refreshAquariumIntelligence(formData: FormData) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const aquariumId = String(formData.get("aquariumId") ?? "");
  const aquarium = await prisma.aquarium.findFirst({ where: { id: aquariumId, collectionId: collection.id }, select: { id: true, name: true } });
  if (!aquarium) throw new Error("Aquarium not found.");
  if (!(await canRefreshAquariumIntelligence(user.id, collection.id))) throw new Error("You do not have permission to refresh aquarium intelligence.");
  await runAquariumIntelligence(aquarium.id, collection.id, "USER", user.id);
  await auditCollectionAction({
    actorUserId: user.id,
    collectionId: collection.id,
    entityType: "AquariumHealthAssessment",
    entityId: aquarium.id,
    action: "AQUARIUM_INTELLIGENCE_REFRESHED",
    summary: `Refreshed aquarium intelligence for ${aquarium.name}.`,
    details: { aquariumId: aquarium.id }
  });
  revalidatePath(`/aquariums/${aquarium.id}`);
  revalidatePath("/dashboard");
  redirect(`/aquariums/${aquarium.id}?workspace=intelligence#workspace`);
}

export async function dismissTimelineInsight(formData: FormData) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  const insightId = String(formData.get("insightId") ?? "");
  const insight = await prisma.aquariumTimelineInsight.findFirst({ where: { id: insightId, collectionId: collection.id } });
  if (!insight) throw new Error("Insight not found.");
  if (!(await canRefreshAquariumIntelligence(user.id, collection.id))) throw new Error("You do not have permission to dismiss timeline insights.");
  await prisma.aquariumTimelineInsight.update({ where: { id: insight.id }, data: { status: "DISMISSED" } });
  await auditCollectionAction({ actorUserId: user.id, collectionId: collection.id, entityType: "AquariumTimelineInsight", entityId: insight.id, action: "AQUARIUM_TIMELINE_INSIGHT_DISMISSED", summary: "Dismissed aquarium timeline insight." });
  revalidatePath(`/aquariums/${insight.aquariumId}`);
}

export async function runAquariumIntelligence(aquariumId: string, collectionId: string, createdBy: "SYSTEM" | "USER" | "WORKER" = "SYSTEM", requestedByUserId?: string | null) {
  const context = await buildAquariumIntelligenceContext(aquariumId, collectionId);
  const analyses = analyzeParameters(context);
  const assessment = buildHealthAssessment(context);
  const insights = generateTimelineInsights(context);
  const [savedAssessment, savedAnalyses, savedInsights] = await Promise.all([
    saveAssessment(collectionId, aquariumId, assessment, createdBy, requestedByUserId),
    saveParameterAnalyses(collectionId, aquariumId, analyses),
    saveTimelineInsights(collectionId, aquariumId, insights)
  ]);
  return { assessment: savedAssessment.assessment, assessmentCreated: savedAssessment.created, analyses: savedAnalyses, insights: savedInsights };
}
