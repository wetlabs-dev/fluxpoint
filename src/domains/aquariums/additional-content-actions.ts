"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { requireCollectionRole, structuralRoles } from "@/domains/auth/permissions";
import { writeAuditLog } from "@/domains/audit/audit-log";
import { setFormFlash } from "@/lib/forms/form-flash";
import {
  additionalContentCategories,
  additionalContentConfidences,
  additionalContentIntents,
  type AdditionalContentCategory,
  type AdditionalContentConfidence,
  type AdditionalContentIntent
} from "@/domains/aquariums/additional-contents";
import type { AquariumAdditionalContentCategory, AquariumAdditionalContentConfidence, AquariumAdditionalContentIntent } from "@prisma/client";

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function bool(formData: FormData, key: string, fallback = false) {
  const values = formData.getAll(key).map(String);
  return values.includes("on") || values.includes("true") || (!values.length && fallback);
}

function enumValue<T extends readonly string[]>(formData: FormData, key: string, allowed: T, fallback: T[number]) {
  const value = String(formData.get(key) ?? "");
  return allowed.includes(value) ? value as T[number] : fallback;
}

async function actionContext(aquariumId: string) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  await requireCollectionRole(collection.id, structuralRoles);
  const aquarium = await prisma.aquarium.findFirstOrThrow({ where: { id: aquariumId, collectionId: collection.id }, select: { id: true, name: true } });
  return { user, collection, aquarium };
}

async function rowContext(id: string) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  await requireCollectionRole(collection.id, structuralRoles);
  const row = await prisma.aquariumAdditionalContent.findFirstOrThrow({ where: { id, collectionId: collection.id }, include: { aquarium: { select: { id: true, name: true } } } });
  return { user, collection, row };
}

function parsedRowData(formData: FormData) {
  const description = text(formData, "description");
  if (!description) throw new Error("Describe the tank content to remember.");
  return {
    category: enumValue(formData, "category", additionalContentCategories, "UNKNOWN" as AdditionalContentCategory) as AquariumAdditionalContentCategory,
    description,
    approximateQuantity: text(formData, "approximateQuantity"),
    confidence: enumValue(formData, "confidence", additionalContentConfidences, "UNKNOWN" as AdditionalContentConfidence) as AquariumAdditionalContentConfidence,
    intent: enumValue(formData, "intent", additionalContentIntents, "INFORMATIONAL" as AdditionalContentIntent) as AquariumAdditionalContentIntent,
    includeInEddyContext: bool(formData, "includeInEddyContext", true),
    notes: text(formData, "notes")
  };
}

export async function createAdditionalTankContent(formData: FormData) {
  const aquariumId = String(formData.get("aquariumId") ?? "");
  const { user, collection, aquarium } = await actionContext(aquariumId);
  const data = parsedRowData(formData);
  const row = await prisma.aquariumAdditionalContent.create({
    data: { collectionId: collection.id, aquariumId: aquarium.id, ...data }
  });

  await writeAuditLog({
    collectionId: collection.id,
    entityType: "AquariumAdditionalContent",
    entityId: row.id,
    action: "AQUARIUM_ADDITIONAL_CONTENT_CREATED",
    after: row,
    createdById: user.id
  });
  revalidatePath(`/aquariums/${aquarium.id}`);
  revalidatePath("/dashboard");
  await setFormFlash(`Remembered extra tank content for ${aquarium.name}.`);
}

export async function updateAdditionalTankContent(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const { user, collection, row: before } = await rowContext(id);
  const data = parsedRowData(formData);
  const row = await prisma.aquariumAdditionalContent.update({ where: { id: before.id }, data });

  await writeAuditLog({
    collectionId: collection.id,
    entityType: "AquariumAdditionalContent",
    entityId: row.id,
    action: "AQUARIUM_ADDITIONAL_CONTENT_UPDATED",
    before,
    after: row,
    createdById: user.id
  });
  revalidatePath(`/aquariums/${before.aquariumId}`);
  revalidatePath("/dashboard");
  await setFormFlash("Updated remembered tank content.");
}

export async function archiveAdditionalTankContent(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const { user, collection, row: before } = await rowContext(id);
  const row = await prisma.aquariumAdditionalContent.update({ where: { id: before.id }, data: { archivedAt: new Date() } });

  await writeAuditLog({
    collectionId: collection.id,
    entityType: "AquariumAdditionalContent",
    entityId: row.id,
    action: "AQUARIUM_ADDITIONAL_CONTENT_ARCHIVED",
    before,
    after: row,
    createdById: user.id
  });
  revalidatePath(`/aquariums/${before.aquariumId}`);
  revalidatePath("/dashboard");
  await setFormFlash("Archived remembered tank content.");
}

export async function deleteAdditionalTankContent(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const { user, collection, row: before } = await rowContext(id);
  await prisma.aquariumAdditionalContent.delete({ where: { id: before.id } });

  await writeAuditLog({
    collectionId: collection.id,
    entityType: "AquariumAdditionalContent",
    entityId: before.id,
    action: "AQUARIUM_ADDITIONAL_CONTENT_DELETED",
    before,
    createdById: user.id
  });
  revalidatePath(`/aquariums/${before.aquariumId}`);
  revalidatePath("/dashboard");
  await setFormFlash("Deleted remembered tank content.");
}
