import type { MediaAsset, User } from "@prisma/client";

type MediaViewer = Pick<User, "id"> & { collectionId?: string | null; isAdmin?: boolean };

function isUnsafeMediaStatus(status: string) {
  return ["CENSORED", "REMOVED", "REJECTED", "FLAGGED"].includes(status);
}

export function canViewMediaAsset(asset: Pick<MediaAsset, "collectionId" | "uploadedById" | "visibility" | "moderationStatus" | "hiddenAt">, viewer?: MediaViewer | null) {
  if (asset.hiddenAt) return false;
  if (isUnsafeMediaStatus(asset.moderationStatus)) return false;
  if (asset.moderationStatus === "APPROVED") {
    if (asset.visibility === "PUBLIC") return true;
    return Boolean(viewer && (viewer.collectionId === asset.collectionId || viewer.isAdmin));
  }
  return Boolean(viewer && (asset.uploadedById === viewer.id || viewer.isAdmin));
}

export function canManageMediaAsset(asset: Pick<MediaAsset, "collectionId">, viewer: MediaViewer) {
  return viewer.collectionId === asset.collectionId || Boolean(viewer.isAdmin);
}

export function isNormallyDisplayable(asset: Pick<MediaAsset, "moderationStatus" | "hiddenAt">) {
  return asset.moderationStatus === "APPROVED" && !asset.hiddenAt;
}
