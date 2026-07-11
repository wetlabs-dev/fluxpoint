import { prisma } from "../src/lib/db/prisma";
import { hashPassword } from "../src/lib/auth/password";
import { enqueueAiJob, coverJobIdempotencyKey } from "../src/domains/ai-jobs/queue";

async function user(email: string, name: string, disabled = false) {
  return prisma.user.upsert({ where: { email }, update: {}, create: { email, name, passwordHash: await hashPassword("Remediation-Only-2026!"), disabledAt: disabled ? new Date() : null } });
}

async function main() {
  await prisma.collection.deleteMany({ where: { name: { in: ["Private Remediation Collection", "Public Remediation Collection"] } } });
  const [owner, aquarist, fishkeeper, viewer, multi, disabled] = await Promise.all([
    user("owner@remediation.invalid", "Collection Owner"), user("aquarist@remediation.invalid", "Aquarist"), user("fishkeeper@remediation.invalid", "Fishkeeper"), user("viewer@remediation.invalid", "Viewer"), user("multi@remediation.invalid", "Multi Collection"), user("disabled@remediation.invalid", "Disabled User", true)
  ]);
  const privateCollection = await prisma.collection.create({ data: { name: "Private Remediation Collection", ownerId: owner.id, memberships: { create: [{ userId: owner.id, role: "COLLECTION_OWNER" }, { userId: aquarist.id, role: "AQUARIST" }, { userId: fishkeeper.id, role: "FISHKEEPER" }, { userId: viewer.id, role: "VIEWER" }, { userId: multi.id, role: "AQUARIST" }] } } });
  const publicCollection = await prisma.collection.create({ data: { name: "Public Remediation Collection", ownerId: owner.id, memberships: { create: [{ userId: owner.id, role: "COLLECTION_OWNER" }, { userId: multi.id, role: "VIEWER" }] }, publicProfile: { create: { isPublicEnabled: true, publicSlug: `remediation-public-${Date.now()}`, displayName: "Remediation Public Collection", showTankList: true, showQrLandingPages: true } } } });
  await prisma.user.update({ where: { id: multi.id }, data: { activeCollectionId: privateCollection.id } });
  const aquarium = await prisma.aquarium.create({ data: { collectionId: publicCollection.id, name: "Published Remediation Aquarium", slug: `published-${Date.now()}`, status: "ACTIVE", targetSalinityMinPpt: 0, targetSalinityMaxPpt: 0.5, publicProfile: { create: { collectionId: publicCollection.id, isPublished: true, publicSlug: `published-${Date.now()}`, showPhotoGallery: true } } } });
  await prisma.aquarium.create({ data: { collectionId: publicCollection.id, name: "Unpublished Remediation Aquarium", slug: `unpublished-${Date.now()}`, status: "ACTIVE", publicProfile: { create: { collectionId: publicCollection.id, isPublished: false, publicSlug: `unpublished-${Date.now()}` } } } });
  const species = await prisma.speciesDefinition.create({ data: { collection: { connect: { id: publicCollection.id } }, commonName: "Remediation Tetra", category: "FISH", salinityMin: 0, salinityMax: 0.5 } });
  await prisma.aquariumItem.create({ data: { collectionId: publicCollection.id, aquariumId: aquarium.id, itemType: "FISH", name: "Remediation Tetras", quantity: 6, speciesDefinitionId: species.id, publicProfile: { create: { collectionId: publicCollection.id, isPublished: true } } } });
  await prisma.accountRequest.create({ data: { email: "pending@remediation.invalid", name: "Pending Request", status: "PENDING", requestedCollectionId: publicCollection.id } });
  const payload = { aquariumId: aquarium.id, selectedConceptId: "fixture-concept", selectedConceptTitle: "Fixture cover", selectedConceptTags: ["fixture"], customPrompt: "A planted freshwater aquarium, documentary style", expectedCoverMediaAssetId: null, setAsCover: true };
  const job = await enqueueAiJob({ collectionId: publicCollection.id, userId: owner.id, jobType: "AQUARIUM_COVER_IMAGE_GENERATION", payload, idempotencyKey: coverJobIdempotencyKey(publicCollection.id, aquarium.id, payload) });
  console.log(JSON.stringify({ privateCollectionId: privateCollection.id, publicCollectionId: publicCollection.id, aquariumId: aquarium.id, jobId: job.id, multiUserId: multi.id }));
}
main().finally(() => prisma.$disconnect());
