import { readFile } from "fs/promises";
import { prisma } from "../src/lib/db/prisma";
import { serializePublicAquarium } from "../src/domains/public/public-serializers";
import { claimAiJobs } from "../src/domains/ai-jobs/claims";
import { recoverStaleAiJobs } from "../src/domains/ai-jobs/claims";
import { cancelPendingAiJob, enqueueAiJob, retryAiJob } from "../src/domains/ai-jobs/queue";

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }

async function main() {
  const schema = await readFile("prisma/schema.prisma", "utf8");
  const publicSerializerSource = await readFile("src/domains/public/public-serializers.ts", "utf8");
  assert(!schema.includes("generatedName"), "Aquarium.generatedName must remain removed.");
  for (const leakedMapping of ["id: aquarium.id", "id: item.id", "id: asset.id", "id: assignment.id", "id: assignment.schedule.id", "id: event.id", "id: link.speciesDefinition.id"]) assert(!publicSerializerSource.includes(leakedMapping), `Public serializer restored internal mapping: ${leakedMapping}`);
  for (const symbol of ["processWorkflowNotificationsNow", "saveSpeciesHusbandryOverrideFieldAction", "export async function createReading(", "export async function generateQrCode(", "export async function generateAiCoverImage("]) {
    const source = await Promise.all(["src/domains/workflows/actions.ts", "src/domains/management/actions.ts", "src/domains/aquariums/actions.ts"].map((file) => readFile(file, "utf8")));
    assert(!source.some((text) => text.includes(symbol)), `Dead action still exists: ${symbol}`);
  }
  const aquarium = await prisma.aquarium.findFirst({ where: { publicProfile: { isNot: null } }, include: { publicProfile: true, coverMediaAsset: true, items: { include: { publicProfile: true, speciesDefinition: true, speciesVariant: true, equipmentProfile: true } } } });
  if (aquarium?.publicProfile) {
    const dto = serializePublicAquarium(aquarium as never);
    const json = JSON.stringify(dto);
    assert(!json.includes(aquarium.id), "Public aquarium DTO leaked its internal database ID.");
  }
  const pending = await prisma.aiJob.findFirst({ where: { status: "PENDING", availableAt: { lte: new Date() } } });
  if (pending) {
    const [first, second] = await Promise.all([claimAiJobs("check-a", 1), claimAiJobs("check-b", 1)]);
    const ids = [...first, ...second].map((job) => job.id);
    assert(new Set(ids).size === ids.length, "Two workers claimed the same AI job.");
    await prisma.aiJob.updateMany({ where: { id: { in: ids }, status: "CLAIMED" }, data: { status: "PENDING", claimedAt: null, claimedBy: null } });
  }
  const aquariumForQueue = await prisma.aquarium.findFirst({ include: { collection: { include: { memberships: true } } } });
  const requester = aquariumForQueue?.collection.memberships.find((membership) => ["COLLECTION_OWNER", "AQUARIST"].includes(membership.role));
  if (aquariumForQueue && requester) {
    const key = `hardening-check:${aquariumForQueue.id}`;
    await prisma.aiJob.deleteMany({ where: { idempotencyKey: key } });
    const payload = { aquariumId: aquariumForQueue.id, selectedConceptTags: [], expectedCoverMediaAssetId: aquariumForQueue.coverMediaAssetId, setAsCover: true };
    const first = await enqueueAiJob({ collectionId: aquariumForQueue.collectionId, userId: requester.userId, jobType: "AQUARIUM_COVER_IMAGE_GENERATION", payload, idempotencyKey: key });
    const duplicate = await enqueueAiJob({ collectionId: aquariumForQueue.collectionId, userId: requester.userId, jobType: "AQUARIUM_COVER_IMAGE_GENERATION", payload, idempotencyKey: key });
    assert(first.id === duplicate.id, "Active idempotency key did not deduplicate AI jobs.");
    assert((await cancelPendingAiJob(first.id, requester.userId)).count === 1, "Pending AI job was not cancellable.");
    await prisma.aiJob.update({ where: { id: first.id }, data: { status: "FAILED" } });
    assert((await retryAiJob(first.id)).count === 1, "Failed AI job was not retryable.");
    await prisma.aiJob.update({ where: { id: first.id }, data: { status: "CLAIMED", claimedAt: new Date(Date.now() - 60 * 60_000), claimedBy: "stale-check" } });
    await recoverStaleAiJobs();
    assert((await prisma.aiJob.findUniqueOrThrow({ where: { id: first.id } })).status === "PENDING", "Stale AI claim was not recovered.");
    await prisma.aiJob.delete({ where: { id: first.id } });
  }
  console.log("Post-audit hardening checks passed.");
}
main().finally(() => prisma.$disconnect());
