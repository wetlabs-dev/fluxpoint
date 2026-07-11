import { prisma } from "../src/lib/db/prisma";
import { processAiJobBatch } from "../src/domains/ai-jobs/worker";
import { enqueueAiJob } from "../src/domains/ai-jobs/queue";

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }

async function main() {
  assert(process.env.DATABASE_URL?.includes(":55432/"), "This verification only runs against the disposable port 55432 database.");
  process.env.AI_PROVIDER = "mock";
  process.env.AI_ENABLED = "true";
  process.env.AI_IMAGE_ENABLED = "true";
  const queued = await prisma.aiJob.findFirstOrThrow({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" } });
  await processAiJobBatch();
  const completed = await prisma.aiJob.findUniqueOrThrow({ where: { id: queued.id }, include: { events: { orderBy: { createdAt: "asc" } } } });
  assert(completed.status === "COMPLETED", "Mock cover job did not complete.");
  const required = ["ENQUEUED", "CLAIMED", "STARTED", "PROVIDER_REQUEST_STARTED", "PROVIDER_RESPONSE_RECEIVED", "MEDIA_SAVED", "MODERATION_COMPLETED", "COVER_ASSIGNED", "COMPLETED"];
  for (const eventType of required) assert(completed.events.some((event) => event.eventType === eventType), `Missing ${eventType} event.`);
  const result = completed.result as Record<string, unknown>;
  const media = await prisma.mediaAsset.findUniqueOrThrow({ where: { id: String(result.mediaId) } });
  const aquarium = await prisma.aquarium.findUniqueOrThrow({ where: { id: String((completed.payload as Record<string, unknown>).aquariumId) } });
  assert(media.moderationStatus === "APPROVED" && aquarium.coverMediaAssetId === media.id, "Media moderation or cover assignment did not persist.");
  const failing = await enqueueAiJob({ collectionId: completed.collectionId, userId: completed.userId, jobType: completed.jobType, payload: { aquariumId: "missing-aquarium", selectedConceptTags: [], setAsCover: true }, idempotencyKey: `failure-check:${Date.now()}` });
  await processAiJobBatch();
  const failed = await prisma.aiJob.findUniqueOrThrow({ where: { id: failing.id }, include: { events: true } });
  assert(failed.status === "FAILED" && failed.events.some((event) => event.eventType === "FAILED"), "Controlled failure did not create a safe failure timeline.");
  assert(!(await prisma.mediaAsset.findFirst({ where: { aquariumId: "missing-aquarium" } })), "Controlled failure left partial media.");
  const mediaCount = await prisma.mediaAsset.count({ where: { aquariumId: aquarium.id } });
  process.env.AI_PROVIDER = "openai";
  process.env.OPENAI_API_KEY = "intentionally-invalid-ai-job-verification";
  const retrying = await enqueueAiJob({ collectionId: completed.collectionId, userId: completed.userId, jobType: completed.jobType, payload: { aquariumId: aquarium.id, selectedConceptTags: [], expectedCoverMediaAssetId: aquarium.coverMediaAssetId, setAsCover: true }, idempotencyKey: `retryable-failure-check:${Date.now()}` });
  await processAiJobBatch();
  const retryResult = await prisma.aiJob.findUniqueOrThrow({ where: { id: retrying.id }, include: { events: true } });
  const retryJson = JSON.stringify(retryResult.events);
  assert(retryResult.status === "PENDING" && retryResult.events.some((event) => event.eventType === "FAILED") && retryResult.events.some((event) => event.eventType === "RETRY_SCHEDULED"), "Retryable provider failure did not schedule a retry.");
  assert(!retryJson.includes("intentionally-invalid") && await prisma.mediaAsset.count({ where: { aquariumId: aquarium.id } }) === mediaCount, "Provider failure exposed a secret or left partial media.");
  console.log(JSON.stringify({ jobId: completed.id, status: completed.status, mediaId: media.id, format: media.mimeType, width: media.width, height: media.height, moderationStatus: media.moderationStatus, assignedAsCover: true, events: completed.events.map((event) => event.eventType), failureJobId: failed.id, failureStatus: failed.status, retryableFailureJobId: retryResult.id, retryableFailureStatus: retryResult.status, retryAt: retryResult.availableAt }));
}

main().finally(() => prisma.$disconnect());
