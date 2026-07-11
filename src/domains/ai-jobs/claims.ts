import type { AiJob } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export async function recoverStaleAiJobs() {
  const cutoff = new Date(Date.now() - Number(process.env.AI_JOB_STALE_CLAIM_MINUTES || 20) * 60_000);
  return prisma.aiJob.updateMany({ where: { status: { in: ["CLAIMED", "RUNNING"] }, claimedAt: { lt: cutoff } }, data: { status: "PENDING", claimedAt: null, claimedBy: null, startedAt: null, availableAt: new Date(), progressMessage: "Recovered after a stale worker claim" } });
}

export async function claimAiJobs(workerId: string, limit: number): Promise<AiJob[]> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "AiJob"
      WHERE "status" = 'PENDING'::"AiJobStatus" AND "availableAt" <= NOW()
      ORDER BY "priority" ASC, "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    `;
    if (!rows.length) return [];
    const ids = rows.map((row) => row.id);
    await tx.aiJob.updateMany({ where: { id: { in: ids }, status: "PENDING" }, data: { status: "CLAIMED", claimedAt: new Date(), claimedBy: workerId, progress: 5, progressMessage: "Claimed by AI worker" } });
    return tx.aiJob.findMany({ where: { id: { in: ids }, claimedBy: workerId, status: "CLAIMED" }, orderBy: [{ priority: "asc" }, { createdAt: "asc" }] });
  });
}
