"use server";

import type { PublicLocationMode } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { collectionOwnerRoles, requireCollectionRole } from "@/domains/auth/permissions";
import { createAuditLog } from "@/domains/audit/audit-service";
import { publicAquariumPath, publicCollectionPath, publicSlug } from "@/domains/public/public-utils";
import { setFormFlash } from "@/lib/forms/form-flash";

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function enabled(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function locationMode(value: string | null): PublicLocationMode {
  return value === "REGION_ONLY" || value === "CITY_STATE_COUNTRY" ? value : "HIDDEN";
}

async function ownerContext() {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  await requireCollectionRole(collection.id, collectionOwnerRoles);
  return { user, collection };
}

async function uniqueCollectionSlug(slug: string, collectionId: string) {
  let candidate = publicSlug(slug);
  let suffix = 2;
  while (await prisma.collectionPublicProfile.findFirst({ where: { publicSlug: candidate, collectionId: { not: collectionId } }, select: { id: true } })) candidate = `${publicSlug(slug)}-${suffix++}`;
  return candidate;
}

async function uniqueAquariumSlug(slug: string, collectionId: string, aquariumId: string) {
  let candidate = publicSlug(slug);
  let suffix = 2;
  while (await prisma.aquariumPublicProfile.findFirst({ where: { collectionId, publicSlug: candidate, aquariumId: { not: aquariumId } }, select: { id: true } })) candidate = `${publicSlug(slug)}-${suffix++}`;
  return candidate;
}

export async function saveCollectionPublicSettings(formData: FormData) {
  const { user, collection } = await ownerContext();
  const before = await prisma.collectionPublicProfile.findUnique({ where: { collectionId: collection.id } });
  const slug = await uniqueCollectionSlug(text(formData, "publicSlug") || collection.name, collection.id);
  const data = {
    isPublicEnabled: enabled(formData, "isPublicEnabled"),
    publicSlug: slug,
    displayName: text(formData, "displayName") || collection.name,
    tagline: text(formData, "tagline"),
    description: text(formData, "description"),
    publicLocationMode: locationMode(text(formData, "publicLocationMode")),
    showOwnerName: enabled(formData, "showOwnerName"),
    showTankList: enabled(formData, "showTankList"),
    showSpeciesList: enabled(formData, "showSpeciesList"),
    showMetrics: enabled(formData, "showMetrics"),
    showTimeline: enabled(formData, "showTimeline"),
    showEquipment: enabled(formData, "showEquipment"),
    showQrLandingPages: enabled(formData, "showQrLandingPages"),
    allowSearchIndexing: enabled(formData, "allowSearchIndexing")
  };
  const profile = await prisma.collectionPublicProfile.upsert({ where: { collectionId: collection.id }, update: data, create: { collectionId: collection.id, ...data } });
  await createAuditLog({ collectionId: collection.id, entityType: "CollectionPublicProfile", entityId: profile.id, action: before?.isPublicEnabled !== profile.isPublicEnabled ? profile.isPublicEnabled ? "PUBLIC_BROWSE_ENABLED" : "PUBLIC_BROWSE_DISABLED" : "PUBLIC_BROWSE_SETTINGS_UPDATED", actorUserId: user.id, before, after: profile });
  revalidatePath("/collection");
  revalidatePath(publicCollectionPath(profile.publicSlug));
  await setFormFlash(`Public browse settings saved. ${profile.isPublicEnabled ? `Public URL: ${publicCollectionPath(profile.publicSlug)}` : "Collection remains private."}`);
}

export async function saveAquariumPublicSettings(formData: FormData) {
  const { user, collection } = await ownerContext();
  const aquariumId = String(formData.get("aquariumId") ?? "");
  const aquarium = await prisma.aquarium.findFirstOrThrow({ where: { id: aquariumId, collectionId: collection.id }, include: { publicProfile: true } });
  const collectionProfile = await prisma.collectionPublicProfile.findUnique({ where: { collectionId: collection.id } });
  const slug = await uniqueAquariumSlug(text(formData, "publicSlug") || aquarium.name, collection.id, aquarium.id);
  const data = {
    collectionId: collection.id,
    isPublished: enabled(formData, "isPublished"),
    publicSlug: slug,
    publicTitle: text(formData, "publicTitle"),
    publicSubtitle: text(formData, "publicSubtitle"),
    publicDescription: text(formData, "publicDescription"),
    showCoverPhoto: enabled(formData, "showCoverPhoto"),
    showInhabitants: enabled(formData, "showInhabitants"),
    showPlants: enabled(formData, "showPlants"),
    showEquipment: enabled(formData, "showEquipment"),
    showMetrics: enabled(formData, "showMetrics"),
    showSchedules: enabled(formData, "showSchedules"),
    showTimeline: enabled(formData, "showTimeline"),
    showConditions: enabled(formData, "showConditions"),
    showPhotoGallery: enabled(formData, "showPhotoGallery"),
    hidePhotoMetadata: enabled(formData, "hidePhotoMetadata"),
    hidePhotoUploadDates: enabled(formData, "hidePhotoUploadDates"),
    showStockingPressure: enabled(formData, "showStockingPressure"),
    showEddySummary: enabled(formData, "showEddySummary")
  };
  const profile = await prisma.aquariumPublicProfile.upsert({ where: { aquariumId: aquarium.id }, update: data, create: { aquariumId: aquarium.id, ...data } });
  const itemIds = formData.getAll("publicItemId").map(String);
  const itemInAquariumScope = { OR: [{ aquariumId: aquarium.id }, { aquariumAttachments: { some: { aquariumId: aquarium.id } } }] };
  await prisma.aquariumItemPublicProfile.updateMany({ where: { collectionId: collection.id, item: itemInAquariumScope }, data: { isPublished: false } });
  for (const itemId of itemIds) {
    const item = await prisma.aquariumItem.findFirst({ where: { id: itemId, collectionId: collection.id, ...itemInAquariumScope }, select: { id: true, name: true } });
    if (!item) continue;
    const itemSlug = publicSlug(`${item.name}-${item.id.slice(-6)}`);
    await prisma.aquariumItemPublicProfile.upsert({
      where: { itemId: item.id },
      update: { collectionId: collection.id, isPublished: true, publicSlug: itemSlug, showQuantity: true },
      create: { collectionId: collection.id, itemId: item.id, isPublished: true, publicSlug: itemSlug, showQuantity: true }
    });
  }
  await createAuditLog({ collectionId: collection.id, entityType: "AquariumPublicProfile", entityId: profile.id, action: aquarium.publicProfile?.isPublished !== profile.isPublished ? profile.isPublished ? "AQUARIUM_PUBLISHED" : "AQUARIUM_UNPUBLISHED" : "AQUARIUM_PUBLIC_SETTINGS_UPDATED", actorUserId: user.id, before: aquarium.publicProfile, after: profile, metadata: { publicItemCount: itemIds.length } });
  revalidatePath(`/aquariums/${aquarium.id}`);
  if (collectionProfile) revalidatePath(publicAquariumPath(collectionProfile.publicSlug, profile.publicSlug));
  await setFormFlash(profile.isPublished ? "Aquarium public settings saved and published." : "Aquarium public settings saved; aquarium remains private.");
}
