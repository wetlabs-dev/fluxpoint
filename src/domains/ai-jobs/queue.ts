import { createHash } from "crypto";
import type { AiJobType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { createAuditLog } from "@/domains/audit/audit-service";
import { aquariumCoverPayloadSchema } from "@/domains/ai-jobs/types";

const activeStatuses = ["PENDING", "CLAIMED", "RUNNING"] as const;

export function coverJobIdempotencyKey(collectionId: string, aquariumId: string, input: unknown) {
  return `cover:${collectionId}:${aquariumId}:${createHash("sha256").update(JSON.stringify(input)).digest("hex").slice(0, 32)}`;
}

export async function enqueueAiJob(input: { collectionId: string; userId: string; jobType: AiJobType; payload: unknown; idempotencyKey?: string | null; priority?: number }) {
  const payload = input.jobType === "AQUARIUM_COVER_IMAGE_GENERATION" ? aquariumCoverPayloadSchema.parse(input.payload) : input.payload;
  if (input.idempotencyKey) {
    const existing = await prisma.aiJob.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing && activeStatuses.includes(existing.status as typeof activeStatuses[number])) return existing;
    if (existing) await prisma.aiJob.update({ where: { id: existing.id }, data: { idempotencyKey: null } });
  }
  const job = await prisma.aiJob.create({ data: { collectionId: input.collectionId, userId: input.userId, jobType: input.jobType, payload: payload as Prisma.InputJsonValue, idempotencyKey: input.idempotencyKey, priority: input.priority ?? 100, maxAttempts: Number(process.env.AI_JOB_MAX_ATTEMPTS || 3) } });
  await createAuditLog({ collectionId: input.collectionId, entityType: "AiJob", entityId: job.id, action: "AI_JOB_ENQUEUED", summary: `${input.jobType.replaceAll("_", " ").toLowerCase()} queued`, actorUserId: input.userId, metadata: { jobType: input.jobType } });
  return job;
}

export async function cancelPendingAiJob(jobId: string, userId: string, admin = false) {
  return prisma.aiJob.updateMany({ where: { id: jobId, status: "PENDING", ...(admin ? {} : { userId }) }, data: { status: "CANCELLED", cancelledAt: new Date(), progressMessage: "Cancelled" } });
}

export async function retryAiJob(jobId: string) {
  return prisma.aiJob.updateMany({ where: { id: jobId, status: { in: ["FAILED", "DEAD_LETTER"] } }, data: { status: "PENDING", availableAt: new Date(), claimedAt: null, claimedBy: null, startedAt: null, completedAt: null, failedAt: null, errorCode: null, errorMessage: null, progress: 0, progressMessage: "Queued for retry" } });
}
