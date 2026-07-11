import { hostname } from "os";
import { prisma } from "@/lib/db/prisma";
import { claimAiJobs, recoverStaleAiJobs } from "@/domains/ai-jobs/claims";
import { handlerForAiJob } from "@/domains/ai-jobs/registry";
import { TerminalAiJobError } from "@/domains/ai-jobs/types";
import { recordAiJobEvent } from "@/domains/ai-jobs/events";

export async function processAiJobBatch() {
  const workerId = `${hostname()}:${process.pid}`;
  const recovered = await recoverStaleAiJobs();
  const jobs = await claimAiJobs(workerId, Math.max(1, Number(process.env.AI_WORKER_BATCH_SIZE || 2)));
  let completed = 0, failed = 0, retried = 0;
  for (const job of jobs) {
    await prisma.aiJob.update({ where: { id: job.id }, data: { status: "RUNNING", startedAt: new Date(), attemptCount: { increment: 1 }, progress: 10, progressMessage: "Starting" } });
    await recordAiJobEvent(prisma, { jobId: job.id, eventType: "STARTED", message: "Attempt started", statusSnapshot: "RUNNING", attemptNumber: job.attemptCount + 1 });
    try {
      const result = await handlerForAiJob(job)(job);
      await prisma.aiJob.update({ where: { id: job.id }, data: { status: "COMPLETED", result: result as never, completedAt: new Date(), progress: 100, progressMessage: "Complete", errorCode: null, errorMessage: null } });
      await recordAiJobEvent(prisma, { jobId: job.id, eventType: "COMPLETED", message: "Completed", statusSnapshot: "COMPLETED", attemptNumber: job.attemptCount + 1, metadata: result });
      completed += 1;
    } catch (error) {
      const current = await prisma.aiJob.findUniqueOrThrow({ where: { id: job.id }, select: { attemptCount: true, maxAttempts: true } });
      const terminal = error instanceof TerminalAiJobError;
      const exhausted = current.attemptCount >= current.maxAttempts;
      const retry = !terminal && !exhausted;
      const retryAt = new Date(Date.now() + Math.min(30, 2 ** current.attemptCount) * 60_000);
      await prisma.aiJob.update({ where: { id: job.id }, data: retry ? { status: "PENDING", availableAt: retryAt, claimedAt: null, claimedBy: null, startedAt: null, failedAt: new Date(), errorCode: "RETRYABLE", errorMessage: safeError(error), progress: 0, progressMessage: "Waiting to retry" } : { status: exhausted ? "DEAD_LETTER" : "FAILED", failedAt: new Date(), errorCode: terminal ? error.code : "FAILED", errorMessage: safeError(error), progressMessage: "Failed" } });
      await recordAiJobEvent(prisma, { jobId: job.id, eventType: "FAILED", message: safeError(error), statusSnapshot: retry ? "PENDING" : exhausted ? "DEAD_LETTER" : "FAILED", attemptNumber: current.attemptCount, metadata: { retryable: retry } });
      if (retry) await recordAiJobEvent(prisma, { jobId: job.id, eventType: "RETRY_SCHEDULED", message: "Retry scheduled", statusSnapshot: "PENDING", attemptNumber: current.attemptCount, metadata: { retryAt: retryAt.toISOString() } });
      if (exhausted) await recordAiJobEvent(prisma, { jobId: job.id, eventType: "DEAD_LETTERED", message: "Maximum attempts reached", statusSnapshot: "DEAD_LETTER", attemptNumber: current.attemptCount });
      retry ? retried += 1 : failed += 1;
    }
  }
  return { summary: `Claimed ${jobs.length} AI job(s): ${completed} completed, ${retried} retrying, ${failed} terminal.`, metadata: { claimed: jobs.length, completed, retried, failed, recovered: recovered.count } };
}

function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : "AI job failed.";
  return message.replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]").slice(0, 500);
}
