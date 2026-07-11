import type { AiJob } from "@prisma/client";

export function serializeUserAiJob(job: AiJob) {
  return { id: job.id, jobType: job.jobType, status: job.status, progress: job.progress, progressMessage: job.progressMessage, result: job.result, error: job.errorMessage ? "The job could not be completed. Retry it or contact an administrator." : null, createdAt: job.createdAt.toISOString(), updatedAt: job.updatedAt.toISOString() };
}
