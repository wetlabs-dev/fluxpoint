"use server";

import { unlink } from "fs/promises";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { careRoles, requireCollectionRole } from "@/domains/auth/permissions";
import { writeAuditLog } from "@/domains/audit/audit-log";
import { localMediaPath } from "@/domains/media/media-service";

async function ownedAsset(id: string) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  await requireCollectionRole(collection.id, careRoles);
  const asset = await prisma.mediaAsset.findFirst({ where: { id, collectionId: collection.id } });
  if (!asset) throw new Error("Photo not found.");
  return { user, asset };
}

export async function setAquariumCoverPhoto(formData: FormData) {
  const id = String(formData.get("id") || "");
  const { user, asset } = await ownedAsset(id);
  if (!asset.aquariumId || asset.moderationStatus !== "APPROVED" || asset.hiddenAt) throw new Error("Only an approved, visible aquarium photo can be used as a cover.");
  const before = await prisma.aquarium.findUnique({ where: { id: asset.aquariumId }, select: { coverMediaAssetId: true } });
  await prisma.aquarium.update({ where: { id: asset.aquariumId }, data: { coverMediaAssetId: asset.id } });
  await writeAuditLog({ collectionId: asset.collectionId, entityType: "MediaAsset", entityId: asset.id, action: "PHOTO_SET_AS_COVER", before, after: { aquariumId: asset.aquariumId }, createdById: user.id });
  revalidatePath(`/aquariums/${asset.aquariumId}`);
  revalidatePath("/aquariums");
  revalidatePath("/dashboard");
}

export async function hideMediaAsset(formData: FormData) {
  const id = String(formData.get("id") || "");
  const { user, asset } = await ownedAsset(id);
  await prisma.$transaction([
    prisma.aquarium.updateMany({ where: { coverMediaAssetId: asset.id }, data: { coverMediaAssetId: null } }),
    prisma.mediaAsset.update({ where: { id: asset.id }, data: { hiddenAt: asset.hiddenAt ? null : new Date() } })
  ]);
  await writeAuditLog({ collectionId: asset.collectionId, entityType: "MediaAsset", entityId: asset.id, action: asset.hiddenAt ? "PHOTO_RESTORED" : "PHOTO_HIDDEN", before: { hiddenAt: asset.hiddenAt }, createdById: user.id });
  if (asset.aquariumId) revalidatePath(`/aquariums/${asset.aquariumId}`);
  revalidatePath("/aquariums");
  revalidatePath("/dashboard");
}

export async function removeMediaAsset(formData: FormData) {
  const id = String(formData.get("id") || "");
  const { user, asset } = await ownedAsset(id);
  await prisma.$transaction([
    prisma.aquarium.updateMany({ where: { coverMediaAssetId: asset.id }, data: { coverMediaAssetId: null } }),
    prisma.moderationReview.deleteMany({ where: { entityType: "MediaAsset", entityId: asset.id } }),
    prisma.mediaAsset.delete({ where: { id: asset.id } })
  ]);
  await unlink(localMediaPath(asset.url)).catch((error) => console.warn("Unable to remove media file", { id: asset.id, error }));
  await writeAuditLog({ collectionId: asset.collectionId, entityType: "MediaAsset", entityId: asset.id, action: "PHOTO_DELETED", before: asset, createdById: user.id });
  if (asset.aquariumId) revalidatePath(`/aquariums/${asset.aquariumId}`);
  revalidatePath("/aquariums");
  revalidatePath("/dashboard");
}
