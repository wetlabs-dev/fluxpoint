"use server";

import { stat, readFile } from "fs/promises";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { aquariumFormSchema } from "@/lib/validation/aquarium";
import { writeAuditLog } from "@/domains/audit/audit-log";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { requireCollectionRole, structuralRoles } from "@/domains/auth/permissions";
import { generateTankCoverImage, moderateImage } from "@/domains/ai/ai-service";
import { ensureAquariumDashboard } from "@/domains/metrics/grafana-service";
import { aquariumEquipmentRoles, isAttachableAquariumItem } from "@/domains/aquariums/equipment-attachments";
import type { AquariumEquipmentRole } from "@prisma/client";
import { legacySalinityForRange } from "@/domains/species/habitat";
import { syncAquariumMetricThresholds } from "@/domains/metrics/aquarium-thresholds";
import { setFormFlash } from "@/lib/forms/form-flash";
import { finishCreateFlow } from "@/lib/forms/create-flow";
import { detectImageType, imageDimensions, localMediaPath } from "@/domains/media/media-service";
import { formatAdditionalContentsForEddy } from "@/domains/aquariums/additional-contents";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function uniqueSlug(name: string, ignoreId?: string) {
  const base = slugify(name) || "aquarium";
  let candidate = base;
  let index = 2;

  while (true) {
    const existing = await prisma.aquarium.findUnique({ where: { slug: candidate } });
    if (!existing || existing.id === ignoreId) return candidate;
    candidate = `${base}-${index}`;
    index += 1;
  }
}

function equipmentAttachmentsFromForm(formData: FormData) {
  const count = Math.min(Math.max(Number(formData.get("equipmentRowCount")) || 0, 0), 50);
  return Array.from({ length: count }, (_, index) => ({
    itemId: String(formData.get(`equipment-${index}-itemId`) ?? "").trim(),
    role: String(formData.get(`equipment-${index}-role`) ?? "OTHER") as AquariumEquipmentRole,
    notes: String(formData.get(`equipment-${index}-notes`) ?? "").trim() || null,
    sortOrder: index
  })).filter((attachment) => attachment.itemId && aquariumEquipmentRoles.includes(attachment.role));
}

async function validateEquipmentAttachments(collectionId: string, attachments: ReturnType<typeof equipmentAttachmentsFromForm>) {
  if (!attachments.length) return;
  const uniqueRows = new Set(attachments.map((attachment) => `${attachment.itemId}:${attachment.role}`));
  if (uniqueRows.size !== attachments.length) throw new Error("The same item cannot be attached to the same role more than once.");
  const items = await prisma.aquariumItem.findMany({ where: { id: { in: attachments.map((attachment) => attachment.itemId) }, collectionId }, select: { id: true, itemType: true } });
  const valid = new Set(items.filter((item) => isAttachableAquariumItem(item.itemType)).map((item) => item.id));
  if (valid.size !== new Set(attachments.map((attachment) => attachment.itemId)).size) throw new Error("Choose equipment or substrate inventory owned by this collection.");
}

function targetProfileData(parsed: ReturnType<typeof aquariumFormSchema.parse>, before?: any) {
  const bounds = (target: number | undefined, previousTarget: number | null | undefined, previousMin: number | null | undefined, previousMax: number | null | undefined, spread: number) => target === previousTarget && (previousMin != null || previousMax != null)
    ? { min: previousMin ?? null, max: previousMax ?? null }
    : { min: target == null ? null : Math.max(0, target - spread), max: target == null ? null : target + spread };
  const temperature = bounds(parsed.targetTemperature, before?.targetTemperature, before?.targetTemperatureMin, before?.targetTemperatureMax, 2);
  const ph = bounds(parsed.targetPh, before?.targetPh, before?.targetPhMin, before?.targetPhMax, 0.3);
  const gh = bounds(parsed.targetGh, before?.targetGh, before?.targetGhMin, before?.targetGhMax, 2);
  const kh = bounds(parsed.targetKh, before?.targetKh, before?.targetKhMin, before?.targetKhMax, 2);
  return {
    waterSource: parsed.waterSource || null,
    targetTemperature: parsed.targetTemperature ?? null, targetTemperatureMin: temperature.min, targetTemperatureMax: temperature.max,
    targetPh: parsed.targetPh ?? null, targetPhMin: ph.min, targetPhMax: ph.max,
    targetGh: parsed.targetGh ?? null, targetGhMin: gh.min, targetGhMax: gh.max,
    targetKh: parsed.targetKh ?? null, targetKhMin: kh.min, targetKhMax: kh.max,
    targetAmmoniaMin: before?.targetAmmoniaMin ?? 0, targetAmmoniaMax: before?.targetAmmoniaMax ?? 0,
    targetNitriteMin: before?.targetNitriteMin ?? 0, targetNitriteMax: before?.targetNitriteMax ?? 0,
    targetNitrateMin: before?.targetNitrateMin ?? 0, targetNitrateMax: before?.targetNitrateMax ?? 40,
    notes: parsed.notes || null
  };
}

export async function createAquarium(formData: FormData) {
  const user = await requireUser();
  const parsed = aquariumFormSchema.parse(Object.fromEntries(formData));
  const collection = await getUserCollection(user.id);
  await requireCollectionRole(collection.id, structuralRoles);
  const slug = await uniqueSlug(parsed.name);
  const attachments = equipmentAttachmentsFromForm(formData);
  await validateEquipmentAttachments(collection.id, attachments);
  const profileData = targetProfileData(parsed);
  const targetSalinityMinPpt = parsed.targetSalinityMinPpt ?? 0;
  const targetSalinityMaxPpt = parsed.targetSalinityMaxPpt ?? 0.5;

  const aquarium = await prisma.aquarium.create({
    data: {
      collectionId: collection.id,
      name: parsed.name,
      slug,
      description: parsed.description || null,
      salinity: legacySalinityForRange(targetSalinityMinPpt, targetSalinityMaxPpt),
      targetSalinityMinPpt,
      targetSalinityMaxPpt,
      aquariumType: parsed.aquariumType,
      volumeGallons: parsed.volumeGallons ?? null,
      volumeUnit: parsed.volumeUnit,
      lengthInches: parsed.lengthInches ?? null,
      widthInches: parsed.widthInches ?? null,
      heightInches: parsed.heightInches ?? null,
      locationId: parsed.locationId || null,
      status: parsed.status,
      startedAt: parsed.startedAt ?? null,
      notes: parsed.notes || null,
      profile: {
        create: profileData
      },
      equipmentAttachments: {
        create: attachments.map((attachment) => ({ collectionId: collection.id, ...attachment }))
      },
      coverCardStyle: {
        palette: ["#123f46", "#7a9d76", "#dac084"],
        mood: "",
        motif: "",
        typographyStyle: "clean rounded sans",
        backgroundType: "soft gradient",
        accentIllustrations: ["bubbles", "sand ripple"],
        promptText: `A calm Fluxpoint cover card for ${parsed.name}.`
      }
    }
  });

  await writeAuditLog({
    entityType: "Aquarium",
    entityId: aquarium.id,
    action: "CREATE",
    after: aquarium,
    createdById: user.id
  });
  const thresholdSync = await syncAquariumMetricThresholds(aquarium.id);
  await writeAuditLog({ collectionId: collection.id, entityType: "Aquarium", entityId: aquarium.id, action: "AQUARIUM_TARGET_PROFILE_INITIALIZED", after: { targetSalinityMinPpt, targetSalinityMaxPpt, profile: profileData }, metadata: { derivedThresholds: thresholdSync.updatedDerivedCount }, createdById: user.id });
  await writeAuditLog({ collectionId: collection.id, entityType: "AquariumMetricConfig", entityId: aquarium.id, action: "METRIC_THRESHOLDS_RECALCULATED", after: thresholdSync.derived, metadata: { updatedDerivedCount: thresholdSync.updatedDerivedCount }, createdById: user.id });
  await ensureAquariumDashboard(aquarium.id);

  revalidatePath("/aquariums");
  revalidatePath("/dashboard");
  await finishCreateFlow(formData, { detailUrl: `/aquariums/${aquarium.id}`, addAnotherUrl: "/aquariums?create=1", createdMessage: `Created aquarium: ${aquarium.name}.`, addAnotherMessage: `Created aquarium: ${aquarium.name}. Ready for another.` });
}

export async function updateAquarium(formData: FormData) {
  const user = await requireUser();
  const parsed = aquariumFormSchema.parse(Object.fromEntries(formData));
  if (!parsed.id) throw new Error("Missing aquarium id.");

  const collection = await getUserCollection(user.id);
  await requireCollectionRole(collection.id, structuralRoles);
  const before = await prisma.aquarium.findFirstOrThrow({ where: { id: parsed.id, collectionId: collection.id }, include: { profile: true } });
  const slug = await uniqueSlug(parsed.name, parsed.id);
  const attachments = equipmentAttachmentsFromForm(formData);
  await validateEquipmentAttachments(collection.id, attachments);
  const profileData = targetProfileData(parsed, before.profile);
  const targetSalinityMinPpt = parsed.targetSalinityMinPpt ?? before.targetSalinityMinPpt ?? 0;
  const targetSalinityMaxPpt = parsed.targetSalinityMaxPpt ?? before.targetSalinityMaxPpt ?? 0.5;
  const aquarium = await prisma.aquarium.update({
    where: { id: parsed.id },
    data: {
      name: parsed.name,
      slug,
      description: parsed.description || null,
      salinity: legacySalinityForRange(targetSalinityMinPpt, targetSalinityMaxPpt),
      targetSalinityMinPpt,
      targetSalinityMaxPpt,
      aquariumType: parsed.aquariumType,
      volumeGallons: parsed.volumeGallons ?? null,
      volumeUnit: parsed.volumeUnit,
      lengthInches: parsed.lengthInches ?? null,
      widthInches: parsed.widthInches ?? null,
      heightInches: parsed.heightInches ?? null,
      locationId: parsed.locationId || null,
      status: parsed.status,
      startedAt: parsed.startedAt ?? null,
      notes: parsed.notes || null,
      profile: {
        upsert: {
          create: profileData,
          update: profileData
        }
      },
      equipmentAttachments: {
        deleteMany: {},
        create: attachments.map((attachment) => ({ collectionId: collection.id, ...attachment }))
      }
    },
    include: { profile: true }
  });

  await writeAuditLog({
    entityType: "Aquarium",
    entityId: aquarium.id,
    action: "UPDATE",
    before,
    after: aquarium,
    createdById: user.id
  });
  if (before.name !== aquarium.name) {
    await writeAuditLog({
      collectionId: collection.id,
      entityType: "Aquarium",
      entityId: aquarium.id,
      action: "AQUARIUM_RENAMED",
      summary: `Aquarium renamed from ${before.name} to ${aquarium.name}`,
      before: { name: before.name },
      after: { name: aquarium.name },
      metadata: { oldName: before.name, newName: aquarium.name, source: "MANUAL" },
      createdById: user.id
    });
  }
  const thresholdSync = await syncAquariumMetricThresholds(aquarium.id);
  const salinityChanged = before.targetSalinityMinPpt !== targetSalinityMinPpt || before.targetSalinityMaxPpt !== targetSalinityMaxPpt;
  await writeAuditLog({ collectionId: collection.id, entityType: "Aquarium", entityId: aquarium.id, action: salinityChanged ? "AQUARIUM_TARGET_SALINITY_CHANGED" : "AQUARIUM_TARGET_PROFILE_CHANGED", before: { targetSalinityMinPpt: before.targetSalinityMinPpt, targetSalinityMaxPpt: before.targetSalinityMaxPpt, profile: before.profile }, after: { targetSalinityMinPpt, targetSalinityMaxPpt, profile: aquarium.profile }, metadata: { derivedThresholdsRecalculated: thresholdSync.updatedDerivedCount }, createdById: user.id });
  await writeAuditLog({ collectionId: collection.id, entityType: "AquariumMetricConfig", entityId: aquarium.id, action: "METRIC_THRESHOLDS_RECALCULATED", after: thresholdSync.derived, metadata: { updatedDerivedCount: thresholdSync.updatedDerivedCount }, createdById: user.id });
  await ensureAquariumDashboard(aquarium.id);

  revalidatePath("/aquariums");
  revalidatePath(`/aquariums/${aquarium.id}`);
  revalidatePath("/dashboard");
  await setFormFlash(`Saved aquarium: ${aquarium.name}.`);
}

export async function archiveAquarium(formData: FormData) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  await requireCollectionRole(collection.id, structuralRoles);
  const id = String(formData.get("id"));
  const before = await prisma.aquarium.findFirstOrThrow({ where: { id, collectionId: collection.id } });
  const aquarium = await prisma.aquarium.update({ where: { id }, data: { status: "ARCHIVED" } });
  await writeAuditLog({
    entityType: "Aquarium",
    entityId: id,
    action: "ARCHIVE",
    before,
    after: aquarium,
    createdById: user.id
  });
  await prisma.grafanaManagedDashboard.updateMany({
    where: { aquariumId: id },
    data: { status: "DISABLED", lastError: "Aquarium archived in Fluxpoint." }
  });
  revalidatePath("/aquariums");
  revalidatePath("/dashboard");
  await setFormFlash(`Archived aquarium: ${aquarium.name}.`);
}

export async function selectAiSuggestion(formData: FormData) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  await requireCollectionRole(collection.id, structuralRoles);
  const aquariumId = String(formData.get("aquariumId"));
  const suggestionType = String(formData.get("suggestionType"));
  const value = String(formData.get("value") ?? "").trim();
  const aquarium = await prisma.aquarium.findFirstOrThrow({ where: { id: aquariumId, collectionId: collection.id } });

  if (suggestionType === "TANK_NAME") {
    if (!value) throw new Error("Choose a name before applying an Eddy suggestion.");
    const replacingExistingName = aquarium.name.trim().length > 0 && aquarium.name !== value;
    if (replacingExistingName && formData.get("confirmReplace") !== "on") {
      throw new Error(`Confirm that you want to replace the current display name “${aquarium.name}” with “${value}”.`);
    }
    const updated = await prisma.aquarium.update({
      where: { id: aquariumId },
      data: { name: value, slug: await uniqueSlug(value, aquariumId) }
    });
    await writeAuditLog({
      collectionId: collection.id,
      entityType: "Aquarium",
      entityId: aquariumId,
      action: "AQUARIUM_RENAMED",
      summary: `Eddy name suggestion applied to ${value}`,
      before: { name: aquarium.name },
      after: { name: updated.name },
      metadata: { oldName: aquarium.name, newName: updated.name, source: "EDDY_NAME_SUGGESTION" },
      createdById: user.id
    });
  }

  if (suggestionType === "COVER_CARD") {
    await prisma.aquarium.update({
      where: { id: aquariumId },
      data: { coverCardStyle: JSON.parse(value) }
    });
  }

  await prisma.aiSuggestion.create({
    data: {
      aquariumId,
      suggestionType: suggestionType as never,
      prompt: "Local mock AI Studio selection",
      response: suggestionType === "COVER_CARD" || suggestionType === "CARE_ADVICE" ? JSON.parse(value) : { name: value },
      selected: true
    }
  });

  await writeAuditLog({
    entityType: "Aquarium",
    entityId: aquariumId,
    action: `SELECT_${suggestionType}`,
    after: { value },
    createdById: user.id
  });

  revalidatePath(`/aquariums/${aquariumId}`);
  revalidatePath("/aquariums");
  revalidatePath("/dashboard");
  if (suggestionType === "TANK_NAME") await setFormFlash(`Renamed aquarium to ${value}.`);
}

export async function generateAiCoverImage(formData: FormData) {
  await generateAiCoverImageForAquarium(String(formData.get("aquariumId")));
}

export async function generateAiCoverImageForAquarium(aquariumId: string, options?: { selectedConceptId?: string | null; selectedConceptTitle?: string | null; selectedConceptPrompt?: string | null; selectedConceptDescription?: string | null; selectedConceptTags?: string[]; customPrompt?: string | null }) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  await requireCollectionRole(collection.id, structuralRoles);
  const aquarium = await prisma.aquarium.findFirstOrThrow({
    where: { id: aquariumId, collectionId: collection.id },
    include: {
      profile: true,
      items: { where: { status: "ACTIVE" }, orderBy: { updatedAt: "desc" } },
      additionalContents: { where: { archivedAt: null, includeInEddyContext: true }, orderBy: [{ category: "asc" }, { createdAt: "asc" }] },
      readings: { orderBy: { measuredAt: "desc" }, take: 8 },
      events: { orderBy: { eventDate: "desc" }, take: 6 }
    }
  });

  const cover = await generateTankCoverImage({
    collectionId: collection.id,
    aquariumId: aquarium.id,
    userId: user.id,
    name: aquarium.name,
    volumeGallons: aquarium.volumeGallons,
    tankType: `${aquarium.salinity} ${aquarium.aquariumType}`,
    stocking: aquarium.items.filter((item) => ["FISH", "INVERT"].includes(item.itemType)).map((item) => item.name),
    plants: aquarium.items.filter((item) => item.itemType === "PLANT").map((item) => item.name),
    additionalContents: formatAdditionalContentsForEddy(aquarium.additionalContents).split("\n").filter(Boolean),
    hardscape: aquarium.items.filter((item) => item.itemType === "HARDSCAPE").map((item) => item.name),
    substrate: aquarium.profile?.substrate,
    lighting: aquarium.profile?.lightingType,
    selectedConceptTitle: options?.selectedConceptTitle,
    selectedConceptPrompt: options?.selectedConceptPrompt,
    selectedConceptDescription: options?.selectedConceptDescription,
    selectedConceptTags: options?.selectedConceptTags,
    customPrompt: options?.customPrompt,
    vibeNotes: options?.selectedConceptPrompt ?? options?.customPrompt ?? aquarium.profile?.notes ?? aquarium.notes,
    latestParameters: aquarium.readings.map((reading) => ({ parameter: reading.parameter, value: reading.value, unit: reading.unit })),
    recentEvents: aquarium.events.map((event) => ({ eventType: event.eventType, title: event.title, summary: event.summary }))
  });

  if (!cover.url) throw new Error("Eddy generated no cover image URL.");
  const absolutePath = localMediaPath(cover.url);
  const [buffer, info] = await Promise.all([readFile(absolutePath), stat(absolutePath)]);
  const mimeType = detectImageType(buffer);
  if (!mimeType) throw new Error("Eddy cover image could not be read as PNG, JPEG, or WebP.");
  const moderation = await moderateImage({
    dataUrl: `data:${mimeType};base64,${buffer.toString("base64")}`,
    filename: cover.filename,
    collectionId: collection.id,
    userId: user.id,
    entityType: "Aquarium",
    entityId: aquarium.id
  });
  if (moderation.blocked) throw new Error(moderation.reason || "The generated cover image was blocked by moderation.");
  const dimensions = imageDimensions(buffer, mimeType);
  const media = await prisma.mediaAsset.create({
    data: {
      collectionId: collection.id,
      aquariumId: aquarium.id,
      uploadedById: user.id,
      filename: cover.filename,
      originalFilename: cover.filename,
      mimeType,
      sizeBytes: Number(info.size),
      width: dimensions.width,
      height: dimensions.height,
      url: cover.url,
      caption: options?.selectedConceptTitle ? `Eddy cover: ${options.selectedConceptTitle}` : "Eddy-generated aquarium cover",
      altText: `Eddy-generated cover image for ${aquarium.name}`,
      moderationStatus: moderation.flagged ? "FLAGGED" : "APPROVED",
      moderationReason: moderation.reason ?? null,
      moderationModel: process.env.OPENAI_MODERATION_MODEL || null,
      moderationCheckedAt: new Date(),
      moderationAttempts: 1
    }
  });

  if (media.moderationStatus !== "APPROVED") throw new Error(moderation.reason || "The generated cover image needs review before it can be used as a cover.");

  await prisma.aquarium.update({
    where: { id: aquarium.id },
    data: { coverImageUrl: cover.url, coverMediaAssetId: media.id }
  });

  await prisma.aiSuggestion.create({
    data: {
      aquariumId: aquarium.id,
      suggestionType: "COVER_CARD",
      prompt: cover.prompt,
      response: { ...cover, mediaAssetId: media.id, selectedConceptId: options?.selectedConceptId ?? null, selectedConceptTitle: options?.selectedConceptTitle ?? null } as never,
      selected: true
    }
  });

  await writeAuditLog({ collectionId: collection.id, entityType: "MediaAsset", entityId: media.id, action: "AI_COVER_IMAGE_APPROVED", after: { aquariumId: aquarium.id, url: cover.url, selectedConceptId: options?.selectedConceptId ?? null }, createdById: user.id });
  await writeAuditLog({
    collectionId: collection.id,
    entityType: "Aquarium",
    entityId: aquarium.id,
    action: "GENERATE_AI_COVER_IMAGE",
    after: { ...cover, mediaAssetId: media.id, selectedConceptId: options?.selectedConceptId ?? null },
    createdById: user.id
  });

  revalidatePath(`/aquariums/${aquarium.id}`);
  revalidatePath("/dashboard");
  return cover;
}
