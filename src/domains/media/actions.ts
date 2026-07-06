"use server";

import { unlink } from "fs/promises";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { careRoles, requireCollectionRole } from "@/domains/auth/permissions";
import { writeAuditLog } from "@/domains/audit/audit-log";
import { localMediaPath } from "@/domains/media/media-service";
import { publicAquariumPath } from "@/domains/public/public-utils";

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

async function ownedAsset(id: string) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  await requireCollectionRole(collection.id, careRoles);
  const asset = await prisma.mediaAsset.findFirst({ where: { id, collectionId: collection.id } });
  if (!asset) throw new Error("Photo not found.");
  return { user, asset };
}

async function revalidateMediaSurfaces(aquariumId?: string | null) {
  if (aquariumId) {
    revalidatePath(`/aquariums/${aquariumId}`);
    const aquarium = await prisma.aquarium.findUnique({ where: { id: aquariumId }, include: { publicProfile: true, collection: { include: { publicProfile: true } } } });
    const collectionSlug = aquarium?.collection.publicProfile?.publicSlug;
    const aquariumSlug = aquarium?.publicProfile?.publicSlug;
    if (collectionSlug && aquariumSlug) revalidatePath(publicAquariumPath(collectionSlug, aquariumSlug));
  }
  revalidatePath("/aquariums");
  revalidatePath("/dashboard");
}

async function fallbackCover(aquariumId: string) {
  const newest = await prisma.mediaAsset.findFirst({
    where: { aquariumId, moderationStatus: "APPROVED", hiddenAt: null, visibility: { not: "PRIVATE" } },
    orderBy: [{ captureDate: "desc" }, { createdAt: "desc" }],
    select: { id: true, url: true }
  });
  await prisma.aquarium.update({ where: { id: aquariumId }, data: { coverMediaAssetId: newest?.id ?? null, coverImageUrl: newest?.url ?? null } });
}

export async function setAquariumCoverPhoto(formData: FormData) {
  const id = String(formData.get("id") || "");
  const { user, asset } = await ownedAsset(id);
  if (!asset.aquariumId || asset.moderationStatus !== "APPROVED" || asset.hiddenAt) throw new Error("Only an approved, visible aquarium photo can be used as a cover.");
  const before = await prisma.aquarium.findUnique({ where: { id: asset.aquariumId }, select: { coverMediaAssetId: true } });
  await prisma.aquarium.update({ where: { id: asset.aquariumId }, data: { coverMediaAssetId: asset.id, coverImageUrl: asset.url } });
  await writeAuditLog({ collectionId: asset.collectionId, entityType: "MediaAsset", entityId: asset.id, action: "PHOTO_SET_AS_COVER", before, after: { aquariumId: asset.aquariumId }, createdById: user.id });
  await revalidateMediaSurfaces(asset.aquariumId);
}

export async function hideMediaAsset(formData: FormData) {
  const id = String(formData.get("id") || "");
  const { user, asset } = await ownedAsset(id);
  await prisma.$transaction([
    prisma.aquarium.updateMany({ where: { coverMediaAssetId: asset.id }, data: { coverMediaAssetId: null, coverImageUrl: null } }),
    prisma.mediaAsset.update({ where: { id: asset.id }, data: { hiddenAt: asset.hiddenAt ? null : new Date() } })
  ]);
  if (!asset.hiddenAt && asset.aquariumId) await fallbackCover(asset.aquariumId);
  await writeAuditLog({ collectionId: asset.collectionId, entityType: "MediaAsset", entityId: asset.id, action: asset.hiddenAt ? "PHOTO_RESTORED" : "PHOTO_HIDDEN", before: { hiddenAt: asset.hiddenAt }, createdById: user.id });
  await revalidateMediaSurfaces(asset.aquariumId);
}

export async function removeMediaAsset(formData: FormData) {
  const id = String(formData.get("id") || "");
  const { user, asset } = await ownedAsset(id);
  await prisma.$transaction([
    prisma.aquarium.updateMany({ where: { coverMediaAssetId: asset.id }, data: { coverMediaAssetId: null, coverImageUrl: null } }),
    prisma.moderationReview.deleteMany({ where: { entityType: "MediaAsset", entityId: asset.id } }),
    prisma.mediaAsset.delete({ where: { id: asset.id } })
  ]);
  await unlink(localMediaPath(asset.url)).catch((error) => console.warn("Unable to remove media file", { id: asset.id, error }));
  if (asset.thumbnailUrl) await unlink(localMediaPath(asset.thumbnailUrl)).catch(() => undefined);
  if (asset.aquariumId) await fallbackCover(asset.aquariumId);
  await writeAuditLog({ collectionId: asset.collectionId, entityType: "MediaAsset", entityId: asset.id, action: "PHOTO_DELETED", before: asset, createdById: user.id });
  await revalidateMediaSurfaces(asset.aquariumId);
}

export async function updateMediaAssetMetadata(formData: FormData) {
  const id = String(formData.get("id") || "");
  const { user, asset } = await ownedAsset(id);
  const captureDateValue = text(formData, "captureDate");
  const captureDate = captureDateValue ? new Date(captureDateValue) : null;
  const tags = text(formData, "tags")?.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 24) ?? [];
  const speciesIds = [...new Set(formData.getAll("speciesDefinitionId").map(String).filter(Boolean))].slice(0, 20);
  const species = speciesIds.length ? await prisma.speciesDefinition.findMany({ where: { id: { in: speciesIds }, OR: [{ collectionId: asset.collectionId }, { collectionId: null }] }, select: { id: true } }) : [];
  if (species.length !== speciesIds.length) throw new Error("One or more selected species could not be linked.");
  const updated = await prisma.mediaAsset.update({
    where: { id: asset.id },
    data: {
      caption: text(formData, "caption"),
      description: text(formData, "description"),
      photographer: text(formData, "photographer"),
      captureDate: captureDate && !Number.isNaN(captureDate.getTime()) ? captureDate : null,
      tags: tags.length ? tags : Prisma.JsonNull,
      altText: text(formData, "altText"),
      speciesLinks: {
        deleteMany: {},
        create: speciesIds.map((speciesDefinitionId) => ({ collectionId: asset.collectionId, speciesDefinitionId }))
      }
    }
  });
  await writeAuditLog({ collectionId: asset.collectionId, entityType: "MediaAsset", entityId: asset.id, action: "PHOTO_METADATA_UPDATED", before: asset, after: updated, createdById: user.id });
  await revalidateMediaSurfaces(asset.aquariumId);
}

export async function askEddyAboutPhoto(formData: FormData) {
  const id = String(formData.get("id") || "");
  const { user, asset } = await ownedAsset(id);
  await writeAuditLog({ collectionId: asset.collectionId, entityType: "MediaAsset", entityId: asset.id, action: "EDDY_PHOTO_GUIDANCE_REQUESTED", metadata: { aquariumId: asset.aquariumId }, createdById: user.id });
  if (asset.aquariumId) revalidatePath(`/aquariums/${asset.aquariumId}`);
}
