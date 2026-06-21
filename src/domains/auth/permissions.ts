import type { CollectionRole } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";

export const collectionRoleLabels: Record<CollectionRole, string> = {
  COLLECTION_OWNER: "Collection Owner",
  AQUARIST: "Aquarist",
  FISHKEEPER: "Fishkeeper",
  VIEWER: "Viewer"
};

export const collectionRoleDescriptions: Record<CollectionRole, string> = {
  COLLECTION_OWNER: "Manages the collection, members, settings, and all records.",
  AQUARIST: "Manages aquariums, inhabitants, equipment, schedules, husbandry, and records.",
  FISHKEEPER: "Logs daily care, feedings, tests, maintenance, photos, and observations.",
  VIEWER: "Read-only access."
};

export const structuralRoles: CollectionRole[] = ["COLLECTION_OWNER", "AQUARIST"];
export const collectionOwnerRoles: CollectionRole[] = ["COLLECTION_OWNER"];
export const careRoles: CollectionRole[] = ["COLLECTION_OWNER", "AQUARIST", "FISHKEEPER"];
export const viewerRoles: CollectionRole[] = ["COLLECTION_OWNER", "AQUARIST", "FISHKEEPER", "VIEWER"];

export async function isServerAdmin(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, serverRole: true, disabledAt: true } });
  if (!user || user.disabledAt) return false;
  if (user.serverRole === "SERVER_ADMIN") return true;

  // Before durable server roles, ADMIN_EMAIL was Fluxpoint's administrator source of truth.
  // Promote that existing account lazily so upgraded installations retain access even when
  // the configured administrator was not the oldest user selected by the role migration.
  const configuredAdminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!configuredAdminEmail || user.email.toLowerCase() !== configuredAdminEmail) return false;
  await prisma.user.updateMany({ where: { id: userId, disabledAt: null, serverRole: "STANDARD_USER" }, data: { serverRole: "SERVER_ADMIN" } });
  return true;
}

export async function requireServerAdmin() {
  const user = await requireUser();
  if (!(await isServerAdmin(user.id))) throw new Error("Server administrator access is required.");
  return user;
}

export async function getCollectionRole(userId: string, collectionId: string) {
  if (await isServerAdmin(userId)) return "COLLECTION_OWNER" as CollectionRole;
  const membership = await prisma.collectionMembership.findUnique({ where: { collectionId_userId: { collectionId, userId } }, select: { role: true } });
  return membership?.role ?? null;
}

export async function requireCollectionRole(collectionId: string, allowedRoles: CollectionRole[]) {
  const user = await requireUser();
  const collection = await prisma.collection.findUnique({ where: { id: collectionId }, select: { archivedAt: true } });
  if (!collection) throw new Error("Collection not found.");
  if (await isServerAdmin(user.id)) return { user, role: "COLLECTION_OWNER" as CollectionRole };
  if (collection.archivedAt) throw new Error("Archived collections are read-only.");
  const role = await getCollectionRole(user.id, collectionId);
  if (!role || !allowedRoles.includes(role)) throw new Error("You do not have permission for this collection.");
  return { user, role };
}

export async function canManageCollection(userId: string, collectionId: string) {
  const role = await getCollectionRole(userId, collectionId);
  return role === "COLLECTION_OWNER";
}

export async function canEditAquarium(userId: string, collectionId: string) {
  const role = await getCollectionRole(userId, collectionId);
  return role === "COLLECTION_OWNER" || role === "AQUARIST";
}

export async function canLogCare(userId: string, collectionId: string) {
  const role = await getCollectionRole(userId, collectionId);
  return role !== null && role !== "VIEWER";
}

export async function canViewCollection(userId: string, collectionId: string) {
  if (await isServerAdmin(userId)) return true;
  const collection = await prisma.collection.findUnique({ where: { id: collectionId }, select: { archivedAt: true } });
  return !collection?.archivedAt && (await getCollectionRole(userId, collectionId)) !== null;
}

export async function canManageUsers(userId: string) {
  return isServerAdmin(userId);
}
