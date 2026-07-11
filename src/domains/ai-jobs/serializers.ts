import type { AiJob } from "@prisma/client";
import { aiJobPriorityLabel } from "@/domains/ai-jobs/priorities";

type JobWithEvents = AiJob & { events?: Array<{ id: string; eventType: string; message: string; metadata: unknown; attemptNumber: number | null; statusSnapshot: string | null; createdAt: Date }> };

export function serializeUserAiJob(job: JobWithEvents) {
  const result = job.result && typeof job.result === "object" && !Array.isArray(job.result) ? job.result as Record<string, unknown> : null;
  return { id: job.id, jobType: job.jobType, status: job.status, progress: job.progress, progressMessage: job.progressMessage, priority: job.priority, priorityLabel: aiJobPriorityLabel(job.priority), availableAt: job.availableAt.toISOString(), nextRetryAt: job.status === "PENDING" && job.attemptCount > 0 ? job.availableAt.toISOString() : null, attemptCount: job.attemptCount, maxAttempts: job.maxAttempts, result: result ? { mediaId: result.mediaId, imageUrl: result.imageUrl, assignedAsCover: result.assignedAsCover, moderationStatus: result.moderationStatus } : null, error: job.errorMessage ? "The job could not be completed. Retry it or contact an administrator." : null, events: (job.events ?? []).map((event) => ({ id: event.id, eventType: event.eventType, message: event.message, attemptNumber: event.attemptNumber, statusSnapshot: event.statusSnapshot, createdAt: event.createdAt.toISOString(), details: safeUserEventDetails(event.metadata) })), createdAt: job.createdAt.toISOString(), updatedAt: job.updatedAt.toISOString() };
}

function safeUserEventDetails(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const data = metadata as Record<string, unknown>;
  return { provider: data.provider, model: data.model, mediaId: data.mediaId, imageUrl: data.imageUrl, moderationStatus: data.moderationStatus, assignedAsCover: data.assignedAsCover, retryAt: data.retryAt };
}
