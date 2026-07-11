import { prisma } from "../src/lib/db/prisma";
import { claimAiJobs } from "../src/domains/ai-jobs/claims";
import { recordAiJobEvent } from "../src/domains/ai-jobs/events";
import { cancelPendingAiJob, changePendingAiJobPriority, enqueueAiJob, retryAiJob } from "../src/domains/ai-jobs/queue";
import { AI_JOB_PRIORITIES } from "../src/domains/ai-jobs/priorities";

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }

async function main() {
  assert(process.env.DATABASE_URL?.includes(":55432/"), "This destructive integration check only runs against the disposable port 55432 database.");
  await prisma.aiJob.deleteMany();
  const aquarium = await prisma.aquarium.findFirst({ include: { collection: { include: { memberships: true } } } });
  const member = aquarium?.collection.memberships.find((item) => ["COLLECTION_OWNER", "AQUARIST"].includes(item.role));
  assert(aquarium && member, "An aquarium with an owner or aquarist fixture is required.");
  const prefix = `observability-check:${Date.now()}`;
  const common = { collectionId: aquarium.collectionId, userId: member.userId, jobType: "AQUARIUM_COVER_IMAGE_GENERATION" as const, payload: { aquariumId: aquarium.id, selectedConceptTags: [], expectedCoverMediaAssetId: aquarium.coverMediaAssetId, setAsCover: true } };
  try {
    const normalOld = await enqueueAiJob({ ...common, priority: AI_JOB_PRIORITIES.NORMAL, idempotencyKey: `${prefix}:normal-old` });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const normalNew = await enqueueAiJob({ ...common, priority: AI_JOB_PRIORITIES.NORMAL, idempotencyKey: `${prefix}:normal-new` });
    const high = await enqueueAiJob({ ...common, priority: AI_JOB_PRIORITIES.HIGH, idempotencyKey: `${prefix}:high` });
    const low = await enqueueAiJob({ ...common, priority: AI_JOB_PRIORITIES.LOW, idempotencyKey: `${prefix}:low` });
    const delayed = await enqueueAiJob({ ...common, priority: AI_JOB_PRIORITIES.IMMEDIATE, idempotencyKey: `${prefix}:delayed` });
    await prisma.aiJob.update({ where: { id: delayed.id }, data: { availableAt: new Date(Date.now() + 3600_000) } });
    const [first, second] = await Promise.all([claimAiJobs(`${prefix}:worker-a`, 2), claimAiJobs(`${prefix}:worker-b`, 2)]);
    const claimed = [...first, ...second];
    assert(new Set(claimed.map((job) => job.id)).size === claimed.length, "Concurrent workers duplicated a claim.");
    const ordered = claimed.sort((a, b) => a.priority - b.priority || a.availableAt.getTime() - b.availableAt.getTime() || a.createdAt.getTime() - b.createdAt.getTime());
    assert(ordered[0]?.id === high.id, "HIGH was not claimed before NORMAL.");
    assert(ordered.findIndex((job) => job.id === normalOld.id) < ordered.findIndex((job) => job.id === normalNew.id), "FIFO was not preserved inside NORMAL.");
    assert(ordered.findIndex((job) => job.id === normalNew.id) < ordered.findIndex((job) => job.id === low.id), "NORMAL was not claimed before LOW.");
    assert(!claimed.some((job) => job.id === delayed.id), "A delayed job was claimed.");
    assert((await changePendingAiJobPriority(delayed.id, AI_JOB_PRIORITIES.MAINTENANCE, member.userId)).count === 1, "Pending admin priority update failed.");
    await prisma.aiJob.update({ where: { id: delayed.id }, data: { status: "RUNNING" } });
    assert((await changePendingAiJobPriority(delayed.id, AI_JOB_PRIORITIES.HIGH, member.userId)).count === 0, "Running job priority was changed.");
    await prisma.aiJob.update({ where: { id: delayed.id }, data: { status: "PENDING" } });
    const actionJob = await enqueueAiJob({ ...common, idempotencyKey: `${prefix}:actions` });
    assert((await cancelPendingAiJob(actionJob.id, member.userId)).count === 1, "Pending job cancellation failed.");
    await prisma.aiJob.update({ where: { id: actionJob.id }, data: { status: "FAILED" } });
    assert((await retryAiJob(actionJob.id, false, member.userId)).count === 1, "Failed job retry failed.");
    const actionEvents = await prisma.aiJobEvent.findMany({ where: { aiJobId: actionJob.id } });
    assert(actionEvents.some((event) => event.eventType === "CANCELLED") && actionEvents.some((event) => event.eventType === "RETRY_SCHEDULED"), "Cancellation or retry event missing.");
    for (const job of claimed) {
      const events = await prisma.aiJobEvent.findMany({ where: { aiJobId: job.id }, orderBy: { createdAt: "asc" } });
      assert(events.some((event) => event.eventType === "ENQUEUED"), "Enqueue event missing.");
      assert(events.some((event) => event.eventType === "CLAIMED"), "Claim event missing.");
    }
    await recordAiJobEvent(prisma, { jobId: high.id, eventType: "PROGRESS", message: "Safe metadata check", metadata: { apiKey: "sk-should-never-persist", authorization: "Bearer secret", imageBase64: "huge", model: "safe-model" } });
    const safeEvent = await prisma.aiJobEvent.findFirstOrThrow({ where: { aiJobId: high.id, eventType: "PROGRESS" }, orderBy: { createdAt: "desc" } });
    const safeJson = JSON.stringify(safeEvent.metadata);
    assert(!safeJson.includes("sk-should") && !safeJson.includes("Bearer secret") && !safeJson.includes("huge"), "Sensitive metadata was persisted.");
    assert(safeJson.includes("safe-model"), "Useful provider metadata was removed.");
    console.log("AI job event, priority, delay, FIFO, concurrency, and metadata safety checks passed.");
  } finally {
    await prisma.aiJob.deleteMany({ where: { idempotencyKey: { startsWith: prefix } } });
  }
}

main().finally(() => prisma.$disconnect());
