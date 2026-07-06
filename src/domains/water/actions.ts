"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { requireCollectionRole, structuralRoles } from "@/domains/auth/permissions";
import { writeAuditLog } from "@/domains/audit/audit-log";
import { setFormFlash } from "@/lib/forms/form-flash";
import { finishCreateFlow } from "@/lib/forms/create-flow";
import type { WaterRecipeDoseUnit, WaterRecipeVolumeUnit, WaterSourceType } from "@prisma/client";

const waterSourceTypes: WaterSourceType[] = ["RODI", "TAP", "WELL", "RAIN", "SPRING", "MIXED", "OTHER"];
const doseUnits: WaterRecipeDoseUnit[] = ["G", "MG", "TSP", "TBSP", "ML", "DROPS", "CAPFUL", "SCOOP", "OTHER"];
const volumeUnits: WaterRecipeVolumeUnit[] = ["GALLON", "LITER"];

async function getCollection() {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  await requireCollectionRole(collection.id, structuralRoles);
  return { user, collection };
}

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function numberValue(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function boolValue(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

export async function createWaterSource(formData: FormData) {
  const { user, collection } = await getCollection();
  const sourceType = String(formData.get("sourceType") ?? "OTHER") as WaterSourceType;
  const data = {
    collectionId: collection.id,
    name: text(formData, "name") ?? "Unnamed water source",
    description: text(formData, "description"),
    sourceType: waterSourceTypes.includes(sourceType) ? sourceType : "OTHER" as WaterSourceType,
    baselinePh: numberValue(formData, "baselinePh"),
    baselineGh: numberValue(formData, "baselineGh"),
    baselineKh: numberValue(formData, "baselineKh"),
    baselineTds: numberValue(formData, "baselineTds"),
    baselineSalinity: numberValue(formData, "baselineSalinity"),
    notes: text(formData, "notes"),
    isDefault: boolValue(formData, "isDefault")
  };
  const source = await prisma.waterSource.create({ data });
  await writeAuditLog({ collectionId: collection.id, entityType: "WaterSource", entityId: source.id, action: "CREATE", after: source, createdById: user.id });
  revalidatePath("/collection");
  await finishCreateFlow(formData, { detailUrl: "/collection#water-sources", addAnotherUrl: "/collection?create=1#water-sources", createdMessage: `Created water source: ${source.name}.`, addAnotherMessage: `Created water source: ${source.name}. Ready for another.` });
}

export async function updateWaterSource(formData: FormData) {
  const { user, collection } = await getCollection();
  const id = String(formData.get("id"));
  const before = await prisma.waterSource.findFirstOrThrow({ where: { id, collectionId: collection.id } });
  const sourceType = String(formData.get("sourceType") ?? before.sourceType) as WaterSourceType;
  const source = await prisma.waterSource.update({
    where: { id },
    data: {
      name: text(formData, "name") ?? before.name,
      description: text(formData, "description"),
      sourceType: waterSourceTypes.includes(sourceType) ? sourceType : "OTHER",
      baselinePh: numberValue(formData, "baselinePh"),
      baselineGh: numberValue(formData, "baselineGh"),
      baselineKh: numberValue(formData, "baselineKh"),
      baselineTds: numberValue(formData, "baselineTds"),
      baselineSalinity: numberValue(formData, "baselineSalinity"),
      notes: text(formData, "notes"),
      isDefault: boolValue(formData, "isDefault"),
      archivedAt: formData.get("archive") ? new Date() : null
    }
  });
  await writeAuditLog({ collectionId: collection.id, entityType: "WaterSource", entityId: id, action: formData.get("archive") ? "ARCHIVE" : "UPDATE", before, after: source, createdById: user.id });
  revalidatePath("/collection");
  await setFormFlash(`Saved water source: ${source.name}.`);
}

export async function deleteWaterSource(formData: FormData) {
  const { user, collection } = await getCollection();
  const id = String(formData.get("id"));
  const before = await prisma.waterSource.findFirstOrThrow({
    where: { id, collectionId: collection.id },
    include: { _count: { select: { aquariums: true, recipes: true } } }
  });
  const usageCount = before._count.aquariums + before._count.recipes;
  if (usageCount > 0) {
    throw new Error(`Cannot delete ${before.name}; it is used by ${before._count.aquariums} tank(s) and ${before._count.recipes} recipe(s). Archive it or move those records first.`);
  }
  await prisma.waterSource.delete({ where: { id } });
  if (before.isDefault) {
    const nextDefault = await prisma.waterSource.findFirst({
      where: { collectionId: collection.id, archivedAt: null },
      orderBy: [{ createdAt: "asc" }, { name: "asc" }]
    });
    if (nextDefault) {
      await prisma.waterSource.update({ where: { id: nextDefault.id }, data: { isDefault: true } });
    }
  }
  await writeAuditLog({ collectionId: collection.id, entityType: "WaterSource", entityId: id, action: "DELETE", before, metadata: { aquariums: before._count.aquariums, recipes: before._count.recipes }, createdById: user.id });
  revalidatePath("/collection");
  revalidatePath("/aquariums");
  await setFormFlash(`Deleted unused water source: ${before.name}.`);
}

export async function createWaterRecipe(formData: FormData) {
  const { user, collection } = await getCollection();
  const waterSourceId = String(formData.get("waterSourceId") ?? "");
  await prisma.waterSource.findFirstOrThrow({ where: { id: waterSourceId, collectionId: collection.id } });
  const recipe = await prisma.waterRecipe.create({
    data: {
      collectionId: collection.id,
      waterSourceId,
      name: text(formData, "name") ?? "Unnamed water recipe",
      description: text(formData, "description"),
      targetPh: numberValue(formData, "targetPh"),
      targetGh: numberValue(formData, "targetGh"),
      targetKh: numberValue(formData, "targetKh"),
      targetTds: numberValue(formData, "targetTds"),
      targetSalinity: numberValue(formData, "targetSalinity"),
      notes: text(formData, "notes"),
      isActive: !formData.get("inactive")
    }
  });
  await writeAuditLog({ collectionId: collection.id, entityType: "WaterRecipe", entityId: recipe.id, action: "CREATE", after: recipe, createdById: user.id });
  revalidatePath("/collection");
  await finishCreateFlow(formData, { detailUrl: "/collection#water-recipes", addAnotherUrl: "/collection?create=1#water-recipes", createdMessage: `Created water recipe: ${recipe.name}.`, addAnotherMessage: `Created water recipe: ${recipe.name}. Ready for another.` });
}

export async function updateWaterRecipe(formData: FormData) {
  const { user, collection } = await getCollection();
  const id = String(formData.get("id"));
  const before = await prisma.waterRecipe.findFirstOrThrow({ where: { id, collectionId: collection.id } });
  const waterSourceId = String(formData.get("waterSourceId") ?? before.waterSourceId);
  await prisma.waterSource.findFirstOrThrow({ where: { id: waterSourceId, collectionId: collection.id } });
  const recipe = await prisma.waterRecipe.update({
    where: { id },
    data: {
      waterSourceId,
      name: text(formData, "name") ?? before.name,
      description: text(formData, "description"),
      targetPh: numberValue(formData, "targetPh"),
      targetGh: numberValue(formData, "targetGh"),
      targetKh: numberValue(formData, "targetKh"),
      targetTds: numberValue(formData, "targetTds"),
      targetSalinity: numberValue(formData, "targetSalinity"),
      notes: text(formData, "notes"),
      isActive: !formData.get("inactive")
    }
  });
  await writeAuditLog({ collectionId: collection.id, entityType: "WaterRecipe", entityId: id, action: "UPDATE", before, after: recipe, createdById: user.id });
  revalidatePath("/collection");
  await setFormFlash(`Saved water recipe: ${recipe.name}.`);
}

export async function archiveWaterRecipe(formData: FormData) {
  const { user, collection } = await getCollection();
  const id = String(formData.get("id"));
  const before = await prisma.waterRecipe.findFirstOrThrow({ where: { id, collectionId: collection.id } });
  const recipe = await prisma.waterRecipe.update({ where: { id }, data: { isActive: false } });
  await writeAuditLog({ collectionId: collection.id, entityType: "WaterRecipe", entityId: id, action: "ARCHIVE", before, after: recipe, createdById: user.id });
  revalidatePath("/collection");
  await setFormFlash(`Archived water recipe: ${recipe.name}.`);
}

export async function addWaterRecipeAdditive(formData: FormData) {
  const { user, collection } = await getCollection();
  const waterRecipeId = String(formData.get("waterRecipeId") ?? "");
  const recipe = await prisma.waterRecipe.findFirstOrThrow({ where: { id: waterRecipeId, collectionId: collection.id } });
  const inventoryItemId = text(formData, "inventoryItemId");
  if (inventoryItemId) await prisma.aquariumItem.findFirstOrThrow({ where: { id: inventoryItemId, collectionId: collection.id } });
  const doseUnit = String(formData.get("doseUnit") ?? "ML") as WaterRecipeDoseUnit;
  const perVolumeUnit = String(formData.get("perVolumeUnit") ?? "GALLON") as WaterRecipeVolumeUnit;
  const additive = await prisma.waterRecipeAdditive.create({
    data: {
      collectionId: collection.id,
      waterRecipeId,
      inventoryItemId,
      additiveName: text(formData, "additiveName") ?? "Unnamed additive",
      doseAmount: numberValue(formData, "doseAmount") ?? 0,
      doseUnit: doseUnits.includes(doseUnit) ? doseUnit : "OTHER",
      perVolumeAmount: numberValue(formData, "perVolumeAmount") ?? 1,
      perVolumeUnit: volumeUnits.includes(perVolumeUnit) ? perVolumeUnit : "GALLON",
      instructions: text(formData, "instructions"),
      sortOrder: numberValue(formData, "sortOrder") ?? 0
    }
  });
  await writeAuditLog({ collectionId: collection.id, entityType: "WaterRecipeAdditive", entityId: additive.id, action: "CREATE", after: additive, metadata: { waterRecipeId: recipe.id }, createdById: user.id });
  revalidatePath("/collection");
  await setFormFlash(`Added ${additive.additiveName} to ${recipe.name}.`);
}

export async function deleteWaterRecipeAdditive(formData: FormData) {
  const { user, collection } = await getCollection();
  const id = String(formData.get("id"));
  const before = await prisma.waterRecipeAdditive.findFirstOrThrow({ where: { id, collectionId: collection.id } });
  await prisma.waterRecipeAdditive.delete({ where: { id } });
  await writeAuditLog({ collectionId: collection.id, entityType: "WaterRecipeAdditive", entityId: id, action: "DELETE", before, createdById: user.id });
  revalidatePath("/collection");
  await setFormFlash(`Removed ${before.additiveName}.`);
}
