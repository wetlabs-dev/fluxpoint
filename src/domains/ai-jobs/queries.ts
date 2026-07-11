import { prisma } from "@/lib/db/prisma";

export function recentUserAiJobs(userId: string, aquariumId?: string) {
  return prisma.aiJob.findMany({ where: { userId, ...(aquariumId ? { payload: { path: ["aquariumId"], equals: aquariumId } } : {}) }, orderBy: { createdAt: "desc" }, take: 20 });
}

export async function aiJobOperationsSummary() {
  const [pending, pendingByPriority, running, failed, deadLetter, oldestPending, oldestHighPending, latestCompleted, latestFailed, latestProviderSuccess] = await Promise.all([
    prisma.aiJob.count({ where: { status: "PENDING" } }), prisma.aiJob.groupBy({ by: ["priority"], where: { status: "PENDING" }, _count: true, _min: { createdAt: true } }), prisma.aiJob.count({ where: { status: { in: ["CLAIMED", "RUNNING"] } } }), prisma.aiJob.count({ where: { status: "FAILED" } }), prisma.aiJob.count({ where: { status: "DEAD_LETTER" } }), prisma.aiJob.findFirst({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" } }), prisma.aiJob.findFirst({ where: { status: "PENDING", priority: 25 }, orderBy: { createdAt: "asc" } }), prisma.aiJob.findFirst({ where: { status: "COMPLETED" }, orderBy: { completedAt: "desc" } }), prisma.aiJob.findFirst({ where: { status: { in: ["FAILED", "DEAD_LETTER"] } }, orderBy: { failedAt: "desc" } }), prisma.aiJobEvent.findFirst({ where: { eventType: "PROVIDER_RESPONSE_RECEIVED", metadata: { path: ["provider"], equals: "openai" } }, orderBy: { createdAt: "desc" } })
  ]);
  return { pending, pendingByPriority, running, failed, deadLetter, oldestPending, oldestHighPending, latestCompleted, latestFailed, latestProviderSuccess };
}
