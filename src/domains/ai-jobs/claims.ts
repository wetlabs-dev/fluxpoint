import type { AiJob } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { recordAiJobEvent } from "@/domains/ai-jobs/events";

export async function recoverStaleAiJobs() {
  const cutoff = new Date(Date.now() - Number(process.env.AI_JOB_STALE_CLAIM_MINUTES || 20) * 60_000);
  return prisma.$transaction(async (tx) => {
    const stale = await tx.aiJob.findMany({ where: { status: { in: ["CLAIMED", "RUNNING"] }, claimedAt: { lt: cutoff } }, select: { id: true, attemptCount: true } });
    if (!stale.length) return { count: 0 };
    const updated = await tx.aiJob.updateMany({ where: { id: { in: stale.map((job) => job.id) }, status: { in: ["CLAIMED", "RUNNING"] } }, data: { status: "PENDING", claimedAt: null, claimedBy: null, startedAt: null, availableAt: new Date(), progress: 0, progressMessage: "Recovered after a stale worker claim" } });
    await Promise.all(stale.map((job) => recordAiJobEvent(tx, { jobId: job.id, eventType: "RETRY_SCHEDULED", message: "Recovered after a stale worker claim", statusSnapshot: "PENDING", attemptNumber: job.attemptCount, metadata: { reason: "stale_worker_claim" } })));
    return updated;
  });
}

export async function claimAiJobs(workerId: string, limit: number): Promise<AiJob[]> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "AiJob"
      WHERE "status" = 'PENDING'::"AiJobStatus" AND "availableAt" <= NOW()
      ORDER BY "priority" ASC, "availableAt" ASC, "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    `;
    if (!rows.length) return [];
    const ids = rows.map((row) => row.id);
    await tx.aiJob.updateMany({ where: { id: { in: ids }, status: "PENDING" }, data: { status: "CLAIMED", claimedAt: new Date(), claimedBy: workerId, progress: 5, progressMessage: "Claimed by AI worker" } });
    const claimed = await tx.aiJob.findMany({ where: { id: { in: ids }, claimedBy: workerId, status: "CLAIMED" }, orderBy: [{ priority: "asc" }, { availableAt: "asc" }, { createdAt: "asc" }] });
    await Promise.all(claimed.map((job) => recordAiJobEvent(tx, { jobId: job.id, eventType: "CLAIMED", message: "Claimed by AI worker", statusSnapshot: "CLAIMED", attemptNumber: job.attemptCount + 1, metadata: { worker: workerId, priority: job.priority } })));
    return claimed;
  });
}
