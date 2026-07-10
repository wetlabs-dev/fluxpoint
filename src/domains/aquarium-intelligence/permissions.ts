import { canViewCollection, getCollectionRole, isServerAdmin } from "@/domains/auth/permissions";

export async function canViewAquariumIntelligence(userId: string, collectionId: string) {
  return canViewCollection(userId, collectionId);
}

export async function canRefreshAquariumIntelligence(userId: string, collectionId: string) {
  if (await isServerAdmin(userId)) return true;
  const role = await getCollectionRole(userId, collectionId);
  return role === "COLLECTION_OWNER" || role === "AQUARIST";
}
