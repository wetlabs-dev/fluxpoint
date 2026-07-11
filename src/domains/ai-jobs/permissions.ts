import { prisma } from "@/lib/db/prisma";
import { requireCollectionRole, structuralRoles } from "@/domains/auth/permissions";

export async function assertCanQueueAquariumCover(userId: string, collectionId: string, aquariumId: string) {
  await requireCollectionRole(collectionId, structuralRoles);
  return prisma.aquarium.findFirstOrThrow({ where: { id: aquariumId, collectionId }, select: { id: true, coverMediaAssetId: true } });
}
