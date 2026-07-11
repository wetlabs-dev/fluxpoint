import { prisma } from "../src/lib/db/prisma";
async function main() {
  const source = await prisma.mediaAsset.findFirstOrThrow();
  for (const row of [
    { id: "remediation-private", filename: "private.png", url: "/uploads/private.png", moderationStatus: "APPROVED" as const, visibility: "PRIVATE" as const, nsfwFlagged: false },
    { id: "remediation-censored", filename: "censored.png", url: "/uploads/censored.png", moderationStatus: "CENSORED" as const, visibility: "PUBLIC" as const, nsfwFlagged: true }
  ]) await prisma.mediaAsset.upsert({ where: { id: row.id }, update: {}, create: { ...row, collectionId: source.collectionId, aquariumId: source.aquariumId, uploadedById: source.uploadedById, originalFilename: row.filename, mimeType: "image/png", sizeBytes: 1, mediaSource: "USER_UPLOAD", moderationAttempts: 1 } });
}
main().finally(() => prisma.$disconnect());
