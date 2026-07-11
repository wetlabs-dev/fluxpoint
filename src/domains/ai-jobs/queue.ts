import { createHash } from "crypto";
import type { AiJobType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { createAuditLog } from "@/domains/audit/audit-service";
import { aquariumCoverPayloadSchema } from "@/domains/ai-jobs/types";
import { recordAiJobEvent } from "@/domains/ai-jobs/events";
import { AI_JOB_PRIORITIES } from "@/domains/ai-jobs/priorities";

const activeStatuses = ["PENDING", "CLAIMED", "RUNNING"] as const;

export function coverJobIdempotencyKey(collectionId: string, aquariumId: string, input: unknown) {
  return `cover:${collectionId}:${aquariumId}:${createHash("sha256").update(JSON.stringify(input)).digest("hex").slice(0, 32)}`;
}

export async function enqueueAiJob(input: { collectionId: string; userId: string; jobType: AiJobType; payload: unknown; idempotencyKey?: string | null; priority?: number }) {
  const payload = input.jobType === "AQUARIUM_COVER_IMAGE_GENERATION" ? aquariumCoverPayloadSchema.parse(input.payload) : input.payload;
  if (input.idempotencyKey) {
    const existing = await prisma.aiJob.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing && activeStatuses.includes(existing.status as typeof activeStatuses[number])) {
      await recordAiJobEvent(prisma, { jobId: existing.id, eventType: "DEDUPLICATED", message: "A matching active job was already queued.", statusSnapshot: existing.status, metadata: { priority: existing.priority, jobType: existing.jobType } });
      return existing;
    }
    if (existing) await prisma.aiJob.update({ where: { id: existing.id }, data: { idempotencyKey: null } });
  }
  const priority = input.priority ?? (input.jobType === "AQUARIUM_COVER_IMAGE_GENERATION" ? AI_JOB_PRIORITIES.HIGH : AI_JOB_PRIORITIES.NORMAL);
  const job = await prisma.aiJob.create({ data: { collectionId: input.collectionId, userId: input.userId, jobType: input.jobType, payload: payload as Prisma.InputJsonValue, idempotencyKey: input.idempotencyKey, priority, maxAttempts: Number(process.env.AI_JOB_MAX_ATTEMPTS || 3), progress: 0, progressMessage: "Queued" } });
  await recordAiJobEvent(prisma, { jobId: job.id, eventType: "ENQUEUED", message: "Queued", statusSnapshot: "PENDING", metadata: { priority, jobType: input.jobType } });
  await createAuditLog({ collectionId: input.collectionId, entityType: "AiJob", entityId: job.id, action: "AI_JOB_ENQUEUED", summary: `${input.jobType.replaceAll("_", " ").toLowerCase()} queued`, actorUserId: input.userId, metadata: { jobType: input.jobType } });
  return job;
}

export async function cancelPendingAiJob(jobId: string, userId: string, admin = false) {
  const result = await prisma.$transaction(async (tx) => {
    const job = await tx.aiJob.findFirst({ where: { id: jobId, ...(admin ? {} : { userId }) }, select: { collectionId: true } });
    const updated = await tx.aiJob.updateMany({ where: { id: jobId, status: "PENDING", ...(admin ? {} : { userId }) }, data: { status: "CANCELLED", cancelledAt: new Date(), progressMessage: "Cancelled" } });
    if (updated.count) await recordAiJobEvent(tx, { jobId, eventType: "CANCELLED", message: admin ? "Cancelled by server administrator" : "Cancelled by requester", statusSnapshot: "CANCELLED" });
    return { ...updated, collectionId: job?.collectionId };
  });
  if (result.count && result.collectionId) await createAuditLog({ collectionId: result.collectionId, entityType: "AiJob", entityId: jobId, action: "AI_JOB_CANCELLED", summary: "AI job cancelled", actorUserId: userId });
  return result;
}

export async function retryAiJob(jobId: string, admin = false, actorUserId?: string) {
  const result = await prisma.$transaction(async (tx) => {
    const job = await tx.aiJob.findUnique({ where: { id: jobId }, select: { collectionId: true } });
    const updated = await tx.aiJob.updateMany({ where: { id: jobId, status: { in: ["FAILED", "DEAD_LETTER"] } }, data: { status: "PENDING", priority: AI_JOB_PRIORITIES.HIGH, availableAt: new Date(), claimedAt: null, claimedBy: null, startedAt: null, completedAt: null, failedAt: null, errorCode: null, errorMessage: null, progress: 0, progressMessage: "Queued for retry" } });
    if (updated.count) await recordAiJobEvent(tx, { jobId, eventType: admin ? "ADMIN_RETRIED" : "RETRY_SCHEDULED", message: admin ? "Retried by server administrator" : "Queued for retry", statusSnapshot: "PENDING", metadata: { priority: AI_JOB_PRIORITIES.HIGH } });
    return { ...updated, collectionId: job?.collectionId };
  });
  if (result.count && result.collectionId && actorUserId) await createAuditLog({ collectionId: result.collectionId, entityType: "AiJob", entityId: jobId, action: admin ? "AI_JOB_ADMIN_RETRIED" : "AI_JOB_RETRIED", summary: "AI job retried", actorUserId });
  return result;
}

export async function changePendingAiJobPriority(jobId: string, priority: number, actorUserId: string) {
  const result = await prisma.$transaction(async (tx) => {
    const job = await tx.aiJob.findUnique({ where: { id: jobId }, select: { status: true, priority: true, collectionId: true } });
    if (!job || job.status !== "PENDING") return { count: 0 };
    await tx.aiJob.update({ where: { id: jobId }, data: { priority } });
    await recordAiJobEvent(tx, { jobId, eventType: "PRIORITY_CHANGED", message: "Priority changed by server administrator", statusSnapshot: "PENDING", metadata: { from: job.priority, to: priority } });
    return { count: 1, collectionId: job.collectionId, previousPriority: job.priority };
  });
  if (result.count && result.collectionId) await createAuditLog({ collectionId: result.collectionId, entityType: "AiJob", entityId: jobId, action: "AI_JOB_PRIORITY_CHANGED", summary: "AI job priority changed", actorUserId, metadata: { from: result.previousPriority, to: priority } });
  return result;
}
