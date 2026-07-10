import { prisma } from "@/lib/db/prisma";

export async function getCurrentAquariumIntelligence(aquariumId: string, collectionId: string) {
  const [assessment, parameterAnalyses, timelineInsights] = await Promise.all([
    prisma.aquariumHealthAssessment.findFirst({ where: { aquariumId, collectionId }, orderBy: { assessedAt: "desc" } }),
    prisma.aquariumParameterAnalysis.findMany({ where: { aquariumId, collectionId }, orderBy: [{ analyzedAt: "desc" }, { concernState: "desc" }], take: 16 }),
    prisma.aquariumTimelineInsight.findMany({ where: { aquariumId, collectionId, status: "ACTIVE" }, orderBy: { createdAt: "desc" }, take: 8 })
  ]);
  return { assessment, parameterAnalyses, timelineInsights };
}

export async function getAssessmentHistory(aquariumId: string, collectionId: string, take = 8) {
  return prisma.aquariumHealthAssessment.findMany({ where: { aquariumId, collectionId }, orderBy: { assessedAt: "desc" }, take });
}

export async function getCollectionIntelligenceSummary(collectionId: string) {
  const aquariums = await prisma.aquarium.findMany({
    where: { collectionId, status: { not: "ARCHIVED" } },
    select: { id: true, name: true, updatedAt: true, healthAssessments: { orderBy: { assessedAt: "desc" }, take: 1 }, parameterAnalyses: { where: { concernState: { in: ["WATCH", "CONCERN", "CRITICAL"] } }, orderBy: { analyzedAt: "desc" }, take: 3 }, timelineInsights: { where: { status: "ACTIVE" }, orderBy: { createdAt: "desc" }, take: 2 } },
    orderBy: { name: "asc" }
  });
  return aquariums.map((aquarium) => {
    const assessment = aquarium.healthAssessments[0] ?? null;
    const stale = assessment ? aquarium.updatedAt > assessment.assessedAt : true;
    const priority = assessment?.healthState === "CRITICAL" ? "urgent" : assessment?.healthState === "CONCERN" ? "review soon" : assessment?.healthState === "WATCH" || stale || aquarium.parameterAnalyses.length ? "review" : assessment ? "stable" : "insufficient data";
    return { aquariumId: aquarium.id, aquariumName: aquarium.name, assessment, stale, parameterAnalyses: aquarium.parameterAnalyses, timelineInsights: aquarium.timelineInsights, priority };
  });
}
