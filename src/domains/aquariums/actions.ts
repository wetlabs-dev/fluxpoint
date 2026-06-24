"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { aquariumFormSchema } from "@/lib/validation/aquarium";
import { writeAuditLog } from "@/domains/audit/audit-log";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { requireCollectionRole, structuralRoles } from "@/domains/auth/permissions";
import { generateTankCoverImage } from "@/domains/ai/ai-service";
import { ensureAquariumDashboard } from "@/domains/metrics/grafana-service";
import { aquariumEquipmentRoles, isAttachableAquariumItem } from "@/domains/aquariums/equipment-attachments";
import type { AquariumEquipmentRole } from "@prisma/client";
import { legacySalinityForRange } from "@/domains/species/habitat";
import { syncAquariumMetricThresholds } from "@/domains/metrics/aquarium-thresholds";
import { setFormFlash } from "@/lib/forms/form-flash";

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
      generatedName: parsed.generatedName || null,
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
  await setFormFlash(`Created aquarium: ${aquarium.generatedName ?? aquarium.name}.`);
  redirect(`/aquariums/${aquarium.id}`);
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
      generatedName: parsed.generatedName || null,
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
  const thresholdSync = await syncAquariumMetricThresholds(aquarium.id);
  const salinityChanged = before.targetSalinityMinPpt !== targetSalinityMinPpt || before.targetSalinityMaxPpt !== targetSalinityMaxPpt;
  await writeAuditLog({ collectionId: collection.id, entityType: "Aquarium", entityId: aquarium.id, action: salinityChanged ? "AQUARIUM_TARGET_SALINITY_CHANGED" : "AQUARIUM_TARGET_PROFILE_CHANGED", before: { targetSalinityMinPpt: before.targetSalinityMinPpt, targetSalinityMaxPpt: before.targetSalinityMaxPpt, profile: before.profile }, after: { targetSalinityMinPpt, targetSalinityMaxPpt, profile: aquarium.profile }, metadata: { derivedThresholdsRecalculated: thresholdSync.updatedDerivedCount }, createdById: user.id });
  await writeAuditLog({ collectionId: collection.id, entityType: "AquariumMetricConfig", entityId: aquarium.id, action: "METRIC_THRESHOLDS_RECALCULATED", after: thresholdSync.derived, metadata: { updatedDerivedCount: thresholdSync.updatedDerivedCount }, createdById: user.id });
  await ensureAquariumDashboard(aquarium.id);

  revalidatePath("/aquariums");
  revalidatePath(`/aquariums/${aquarium.id}`);
  revalidatePath("/dashboard");
  await setFormFlash(`Saved aquarium: ${aquarium.generatedName ?? aquarium.name}.`);
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
  await setFormFlash(`Archived aquarium: ${aquarium.generatedName ?? aquarium.name}.`);
}

export async function selectAiSuggestion(formData: FormData) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  await requireCollectionRole(collection.id, structuralRoles);
  const aquariumId = String(formData.get("aquariumId"));
  const suggestionType = String(formData.get("suggestionType"));
  const value = String(formData.get("value"));
  await prisma.aquarium.findFirstOrThrow({ where: { id: aquariumId, collectionId: collection.id } });

  if (suggestionType === "TANK_NAME") {
    await prisma.aquarium.update({
      where: { id: aquariumId },
      data: { generatedName: value }
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
  revalidatePath("/dashboard");
}

export async function generateAiCoverImage(formData: FormData) {
  await generateAiCoverImageForAquarium(String(formData.get("aquariumId")));
}

export async function generateAiCoverImageForAquarium(aquariumId: string) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  await requireCollectionRole(collection.id, structuralRoles);
  const aquarium = await prisma.aquarium.findFirstOrThrow({
    where: { id: aquariumId, collectionId: collection.id },
    include: {
      profile: true,
      items: { where: { status: "ACTIVE" }, orderBy: { updatedAt: "desc" } },
      readings: { orderBy: { measuredAt: "desc" }, take: 8 },
      events: { orderBy: { eventDate: "desc" }, take: 6 }
    }
  });

  const cover = await generateTankCoverImage({
    collectionId: collection.id,
    aquariumId: aquarium.id,
    userId: user.id,
    name: aquarium.generatedName ?? aquarium.name,
    volumeGallons: aquarium.volumeGallons,
    tankType: `${aquarium.salinity} ${aquarium.aquariumType}`,
    stocking: aquarium.items.filter((item) => ["FISH", "INVERT"].includes(item.itemType)).map((item) => item.name),
    plants: aquarium.items.filter((item) => item.itemType === "PLANT").map((item) => item.name),
    hardscape: aquarium.items.filter((item) => item.itemType === "HARDSCAPE").map((item) => item.name),
    substrate: aquarium.profile?.substrate,
    lighting: aquarium.profile?.lightingType,
    vibeNotes: aquarium.profile?.notes ?? aquarium.notes,
    latestParameters: aquarium.readings.map((reading) => ({ parameter: reading.parameter, value: reading.value, unit: reading.unit })),
    recentEvents: aquarium.events.map((event) => ({ eventType: event.eventType, title: event.title, summary: event.summary }))
  });

  await prisma.aquarium.update({
    where: { id: aquarium.id },
    data: { coverImageUrl: cover.url }
  });

  await prisma.aiSuggestion.create({
    data: {
      aquariumId: aquarium.id,
      suggestionType: "COVER_CARD",
      prompt: cover.prompt,
      response: cover as never,
      selected: true
    }
  });

  await writeAuditLog({
    entityType: "Aquarium",
    entityId: aquarium.id,
    action: "GENERATE_AI_COVER_IMAGE",
    after: cover,
    createdById: user.id
  });

  revalidatePath(`/aquariums/${aquarium.id}`);
  revalidatePath("/dashboard");
  return cover;
}
