"use server";

import { createHash, randomBytes } from "crypto";
import { addDays, addMonths } from "date-fns";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { writeAuditLog } from "@/domains/audit/audit-log";
import { appUrl, sendEmail } from "@/domains/email/email-service";
import { invitationEmail } from "@/domains/email/templates";
import { legacyPointValues, parseLightChannels, pointValuesFromForm } from "@/domains/lighting/capabilities";
import {
  deleteSpeciesHusbandryGuide,
  forkSpeciesHusbandryGuide,
  husbandryFormDataForGuide,
  linkSpeciesHusbandryGuide,
  saveSpeciesHusbandryGuide,
  saveSpeciesHusbandryGuideField,
  saveSpeciesHusbandryOverride,
  saveSpeciesHusbandryOverrideField
} from "@/domains/husbandry/husbandry-service";
import { inferSpeciesHusbandryType, type HusbandrySpeciesType } from "@/domains/husbandry/husbandry-fields";

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function numberValue(formData: FormData, key: string) {
  const value = text(formData, key);
  return value === null ? null : Number(value);
}

function decimalString(formData: FormData, key: string) {
  const value = text(formData, key);
  return value === null ? null : value;
}

function buildScientificNameFromForm(formData: FormData) {
  const base = [text(formData, "genus"), text(formData, "species")].filter(Boolean).join(" ");
  const variety = text(formData, "variety");
  const cultivar = text(formData, "cultivar");
  return [base || null, variety ? `var. ${variety}` : null, cultivar ? `'${cultivar}'` : null].filter(Boolean).join(" ") || null;
}

function dateValue(formData: FormData, key: string) {
  const value = text(formData, key);
  return value === null ? null : new Date(value);
}

function itemPlacementFromForm(formData: FormData) {
  const aquariumId = text(formData, "aquariumId");
  const storageLocationId = text(formData, "storageLocationId");
  const quarantineProjectId = text(formData, "quarantineProjectId");
  if (quarantineProjectId) return { aquariumId: null, storageLocationId: null, quarantineProjectId, status: "IN_QUARANTINE" };
  if (aquariumId) return { aquariumId, storageLocationId: null, quarantineProjectId: null, status: "IN_AQUARIUM" };
  if (storageLocationId) return { aquariumId: null, storageLocationId, quarantineProjectId: null, status: "IN_STORAGE" };
  return { aquariumId: null, storageLocationId: null, quarantineProjectId: null, status: "ACTIVE" };
}

async function validateItemPlacement(collectionId: string, placement: ReturnType<typeof itemPlacementFromForm>) {
  if (placement.aquariumId) {
    await prisma.aquarium.findFirstOrThrow({ where: { id: placement.aquariumId, collectionId } });
  }
  if (placement.storageLocationId) {
    await prisma.location.findFirstOrThrow({ where: { id: placement.storageLocationId, collectionId } });
  }
  if (placement.quarantineProjectId) {
    await prisma.quarantineProject.findFirstOrThrow({ where: { id: placement.quarantineProjectId, collectionId } });
  }
}

function nextDueDate(from: Date, cadenceType: string, intervalDays?: number | null, dayOfMonth?: number | null) {
  if (cadenceType === "DAILY") return addDays(from, 1);
  if (cadenceType === "WEEKLY") return addDays(from, 7);
  if (cadenceType === "MONTHLY") {
    const next = addMonths(from, 1);
    if (dayOfMonth) next.setDate(Math.min(dayOfMonth, 28));
    return next;
  }
  if (cadenceType === "EVERY_N_DAYS") return addDays(from, Math.max(intervalDays ?? 1, 1));
  return null;
}

function taskTitle(schedule: { name: string; scheduleType: string }) {
  return `${schedule.name}${schedule.scheduleType === "FEEDING" ? " feeding" : ""}`;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function createPendingTaskForSchedule(schedule: {
  id: string;
  aquariumId: string | null;
  name: string;
  description: string | null;
  scheduleType: string;
  nextDueAt: Date | null;
}) {
  if (!schedule.nextDueAt) return null;
  return prisma.careTask.create({
    data: {
      careScheduleId: schedule.id,
      aquariumId: schedule.aquariumId,
      title: taskTitle(schedule),
      description: schedule.description,
      dueAt: schedule.nextDueAt
    }
  });
}

async function getCollection() {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  return { user, collection };
}

export async function createSpecies(formData: FormData) {
  const { user, collection } = await getCollection();
  const species = await prisma.speciesDefinition.create({
    data: {
      collectionId: collection.id,
      category: String(formData.get("category") ?? "OTHER") as never,
      commonName: text(formData, "commonName") ?? "Unnamed species",
      scientificName: buildScientificNameFromForm(formData),
      genus: text(formData, "genus"),
      species: text(formData, "species"),
      variety: text(formData, "variety"),
      cultivar: text(formData, "cultivar"),
      careNotes: text(formData, "careNotes"),
      lifespan: text(formData, "lifespan"),
      minimumGroupSize: numberValue(formData, "minimumGroupSize"),
      maxHeight: numberValue(formData, "maxHeight"),
      maxSpread: numberValue(formData, "maxSpread"),
      growthRate: text(formData, "growthRate"),
      lightRequirement: text(formData, "lightRequirement"),
      co2Preference: text(formData, "co2Preference"),
      preferredHardness: text(formData, "preferredHardness"),
      breedingNotes: text(formData, "breedingNotes"),
      flowRequirement: text(formData, "flowRequirement"),
      tempMin: numberValue(formData, "tempMin"),
      tempMax: numberValue(formData, "tempMax"),
      phMin: numberValue(formData, "phMin"),
      phMax: numberValue(formData, "phMax"),
      ghMin: numberValue(formData, "ghMin"),
      ghMax: numberValue(formData, "ghMax"),
      khMin: numberValue(formData, "khMin"),
      khMax: numberValue(formData, "khMax"),
      salinityMin: numberValue(formData, "salinityMin"),
      salinityMax: numberValue(formData, "salinityMax"),
      notes: text(formData, "notes")
    }
  });
  await writeAuditLog({ entityType: "SpeciesDefinition", entityId: species.id, action: "CREATE", after: species, createdById: user.id });
  revalidatePath("/species");
}

export async function updateSpecies(formData: FormData) {
  const { user, collection } = await getCollection();
  const id = String(formData.get("id"));
  const before = await prisma.speciesDefinition.findFirstOrThrow({ where: { id, OR: [{ collectionId: collection.id }, { collectionId: null }] } });
  const species = await prisma.speciesDefinition.update({
    where: { id },
    data: {
      category: String(formData.get("category") ?? "OTHER") as never,
      commonName: text(formData, "commonName") ?? "Unnamed species",
      scientificName: buildScientificNameFromForm(formData),
      genus: text(formData, "genus"),
      species: text(formData, "species"),
      variety: text(formData, "variety"),
      cultivar: text(formData, "cultivar"),
      careNotes: text(formData, "careNotes"),
      lifespan: text(formData, "lifespan"),
      minimumGroupSize: numberValue(formData, "minimumGroupSize"),
      maxHeight: numberValue(formData, "maxHeight"),
      maxSpread: numberValue(formData, "maxSpread"),
      growthRate: text(formData, "growthRate"),
      lightRequirement: text(formData, "lightRequirement"),
      co2Preference: text(formData, "co2Preference"),
      preferredHardness: text(formData, "preferredHardness"),
      breedingNotes: text(formData, "breedingNotes"),
      flowRequirement: text(formData, "flowRequirement"),
      tempMin: numberValue(formData, "tempMin"),
      tempMax: numberValue(formData, "tempMax"),
      phMin: numberValue(formData, "phMin"),
      phMax: numberValue(formData, "phMax"),
      ghMin: numberValue(formData, "ghMin"),
      ghMax: numberValue(formData, "ghMax"),
      khMin: numberValue(formData, "khMin"),
      khMax: numberValue(formData, "khMax"),
      salinityMin: numberValue(formData, "salinityMin"),
      salinityMax: numberValue(formData, "salinityMax"),
      notes: text(formData, "notes")
    }
  });
  await writeAuditLog({ entityType: "SpeciesDefinition", entityId: species.id, action: "UPDATE", before, after: species, createdById: user.id });
  revalidatePath("/species");
}

export async function deleteSpecies(formData: FormData) {
  const { user, collection } = await getCollection();
  const id = String(formData.get("id"));
  const used = await prisma.aquariumItem.count({ where: { speciesDefinitionId: id } });
  if (used > 0) throw new Error("This species cannot be deleted while inventory items reference it.");
  const before = await prisma.speciesDefinition.findFirstOrThrow({ where: { id, OR: [{ collectionId: collection.id }, { collectionId: null }] } });
  await prisma.speciesDefinition.delete({ where: { id } });
  await writeAuditLog({ entityType: "SpeciesDefinition", entityId: id, action: "DELETE", before, createdById: user.id });
  revalidatePath("/species");
}

export async function saveSpeciesHusbandryGuideAction(formData: FormData) {
  const { user, collection } = await getCollection();
  const speciesDefinitionId = String(formData.get("speciesDefinitionId"));
  const definition = await prisma.speciesDefinition.findFirstOrThrow({ where: { id: speciesDefinitionId, OR: [{ collectionId: collection.id }, { collectionId: null }] } });
  const speciesType = String(formData.get("speciesType") || inferSpeciesHusbandryType(definition)) as HusbandrySpeciesType;
  const guide = await saveSpeciesHusbandryGuide({
    collectionId: collection.id,
    speciesDefinitionId,
    speciesType,
    summary: text(formData, "summary"),
    careDifficulty: text(formData, "careDifficulty"),
    sourceNotes: text(formData, "sourceNotes"),
    status: String(formData.get("status") || "LOCAL") as never,
    fields: husbandryFormDataForGuide(speciesType, formData)
  });
  await writeAuditLog({ entityType: "SpeciesHusbandryGuide", entityId: guide.id, action: "UPDATE", after: guide, createdById: user.id });
  revalidatePath("/species");
  revalidatePath(`/species/${speciesDefinitionId}`);
}

export async function saveSpeciesHusbandryGuideFieldAction(formData: FormData) {
  const { user, collection } = await getCollection();
  const speciesDefinitionId = String(formData.get("speciesDefinitionId"));
  const fieldName = String(formData.get("fieldName"));
  const guide = await saveSpeciesHusbandryGuideField({
    collectionId: collection.id,
    speciesDefinitionId,
    fieldName,
    fieldValue: text(formData, "fieldValue")
  });
  await writeAuditLog({ entityType: "SpeciesHusbandryGuide", entityId: guide.id, action: "UPDATE_FIELD", after: { fieldName }, createdById: user.id });
  revalidatePath("/species");
  revalidatePath(`/species/${speciesDefinitionId}`);
}

export async function linkSpeciesHusbandryGuideAction(formData: FormData) {
  const { user, collection } = await getCollection();
  const speciesDefinitionId = String(formData.get("speciesDefinitionId"));
  const sourceSpeciesDefinitionId = String(formData.get("sourceSpeciesDefinitionId"));
  const guide = await linkSpeciesHusbandryGuide(collection.id, speciesDefinitionId, sourceSpeciesDefinitionId, text(formData, "sourceNotes"));
  await writeAuditLog({ entityType: "SpeciesHusbandryGuide", entityId: guide.id, action: "LINK", after: guide, createdById: user.id });
  revalidatePath("/species");
  revalidatePath(`/species/${speciesDefinitionId}`);
}

export async function forkSpeciesHusbandryGuideAction(formData: FormData) {
  const { user, collection } = await getCollection();
  const speciesDefinitionId = String(formData.get("speciesDefinitionId"));
  const guide = await forkSpeciesHusbandryGuide(collection.id, speciesDefinitionId);
  await writeAuditLog({ entityType: "SpeciesHusbandryGuide", entityId: guide.id, action: "FORK", after: guide, createdById: user.id });
  revalidatePath("/species");
  revalidatePath(`/species/${speciesDefinitionId}`);
}

export async function deleteSpeciesHusbandryGuideAction(formData: FormData) {
  const { user, collection } = await getCollection();
  const speciesDefinitionId = String(formData.get("speciesDefinitionId"));
  await deleteSpeciesHusbandryGuide(collection.id, speciesDefinitionId);
  await writeAuditLog({ entityType: "SpeciesHusbandryGuide", entityId: speciesDefinitionId, action: "DELETE", createdById: user.id });
  revalidatePath("/species");
  revalidatePath(`/species/${speciesDefinitionId}`);
}

export async function saveSpeciesHusbandryOverrideAction(formData: FormData) {
  const { user, collection } = await getCollection();
  const aquariumItemId = String(formData.get("aquariumItemId"));
  const speciesType = String(formData.get("speciesType") || "OTHER") as HusbandrySpeciesType;
  const override = await saveSpeciesHusbandryOverride({
    collectionId: collection.id,
    aquariumItemId,
    fields: husbandryFormDataForGuide(speciesType, formData),
    overrideNotes: text(formData, "overrideNotes")
  });
  await writeAuditLog({ entityType: "SpeciesHusbandryOverride", entityId: override?.id ?? aquariumItemId, action: override ? "UPDATE" : "DELETE", after: override, createdById: user.id });
  revalidatePath("/inventory");
  revalidatePath("/aquariums");
}

export async function saveSpeciesHusbandryOverrideFieldAction(formData: FormData) {
  const { user, collection } = await getCollection();
  const aquariumItemId = String(formData.get("aquariumItemId"));
  const fieldName = String(formData.get("fieldName"));
  const override = await saveSpeciesHusbandryOverrideField({
    collectionId: collection.id,
    aquariumItemId,
    fieldName,
    fieldValue: text(formData, "fieldValue")
  });
  await writeAuditLog({ entityType: "SpeciesHusbandryOverride", entityId: override?.id ?? aquariumItemId, action: "UPDATE_FIELD", after: { fieldName }, createdById: user.id });
  revalidatePath("/inventory");
  revalidatePath("/aquariums");
}

export async function createItem(formData: FormData) {
  const { user, collection } = await getCollection();
  const itemType = String(formData.get("itemType") ?? "OTHER");
  const placement = itemPlacementFromForm(formData);
  await validateItemPlacement(collection.id, placement);
  const item = await prisma.aquariumItem.create({
    data: {
      collectionId: collection.id,
      itemType: itemType as never,
      aquariumId: placement.aquariumId,
      storageLocationId: placement.storageLocationId,
      quarantineProjectId: placement.quarantineProjectId,
      speciesDefinitionId: text(formData, "speciesDefinitionId"),
      sourceId: text(formData, "sourceId"),
      name: text(formData, "name") ?? "Unnamed item",
      description: text(formData, "description"),
      quantity: numberValue(formData, "quantity") ?? 1,
      unit: text(formData, "unit"),
      status: String(formData.get("status") ?? placement.status) as never,
      purchasePrice: decimalString(formData, "purchasePrice"),
      acquiredAt: dateValue(formData, "acquiredAt"),
      notes: text(formData, "notes")
    }
  });
  await writeAuditLog({ entityType: "AquariumItem", entityId: item.id, action: "CREATE", after: item, createdById: user.id });
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
}

export async function updateItem(formData: FormData) {
  const { user, collection } = await getCollection();
  const id = String(formData.get("id"));
  const before = await prisma.aquariumItem.findFirstOrThrow({ where: { id, collectionId: collection.id } });
  const placement = itemPlacementFromForm(formData);
  await validateItemPlacement(collection.id, placement);
  const item = await prisma.aquariumItem.update({
    where: { id },
    data: {
      itemType: String(formData.get("itemType") ?? before.itemType) as never,
      aquariumId: placement.aquariumId,
      storageLocationId: placement.storageLocationId,
      quarantineProjectId: placement.quarantineProjectId,
      speciesDefinitionId: text(formData, "speciesDefinitionId"),
      sourceId: text(formData, "sourceId"),
      name: text(formData, "name") ?? before.name,
      description: text(formData, "description"),
      quantity: numberValue(formData, "quantity") ?? before.quantity,
      unit: text(formData, "unit"),
      status: String(formData.get("status") ?? before.status) as never,
      purchasePrice: decimalString(formData, "purchasePrice"),
      acquiredAt: dateValue(formData, "acquiredAt"),
      notes: text(formData, "notes")
    }
  });
  await writeAuditLog({ entityType: "AquariumItem", entityId: id, action: "UPDATE", before, after: item, createdById: user.id });
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
}

export async function archiveItem(formData: FormData) {
  const { user, collection } = await getCollection();
  const id = String(formData.get("id"));
  const before = await prisma.aquariumItem.findFirstOrThrow({ where: { id, collectionId: collection.id } });
  const item = await prisma.aquariumItem.update({ where: { id }, data: { status: "ARCHIVED" } });
  await writeAuditLog({ entityType: "AquariumItem", entityId: id, action: "ARCHIVE", before, after: item, createdById: user.id });
  revalidatePath("/inventory");
  revalidatePath("/equipment");
  revalidatePath("/dashboard");
}

export async function transferItem(formData: FormData) {
  const { user, collection } = await getCollection();
  const itemId = String(formData.get("itemId"));
  const destinationType = String(formData.get("destinationType") ?? "AQUARIUM");
  const toAquariumId = text(formData, "toAquariumId");
  const toStorageLocationId = text(formData, "toStorageLocationId");
  const toQuarantineProjectId = text(formData, "toQuarantineProjectId");
  const quantity = numberValue(formData, "quantity") ?? 1;
  const reason = text(formData, "reason");
  const notes = text(formData, "notes");
  if (quantity <= 0) throw new Error("Transfer quantity must be greater than zero.");
  const item = await prisma.aquariumItem.findFirstOrThrow({ where: { id: itemId, collectionId: collection.id } });
  if (quantity > item.quantity) throw new Error("Transfer quantity cannot exceed the available quantity.");
  if (destinationType === "AQUARIUM" && !toAquariumId) throw new Error("Choose a destination aquarium.");
  if (destinationType === "STORAGE" && !toStorageLocationId) throw new Error("Choose a destination storage location.");
  if (destinationType === "QUARANTINE" && !toQuarantineProjectId) throw new Error("Choose a destination quarantine project.");
  if (destinationType === "AQUARIUM") {
    await prisma.aquarium.findFirstOrThrow({ where: { id: toAquariumId!, collectionId: collection.id } });
  }
  if (destinationType === "STORAGE") {
    await prisma.location.findFirstOrThrow({ where: { id: toStorageLocationId!, collectionId: collection.id } });
  }
  if (destinationType === "QUARANTINE") {
    await prisma.quarantineProject.findFirstOrThrow({ where: { id: toQuarantineProjectId!, collectionId: collection.id } });
  }
  const fullTransfer = quantity >= item.quantity;
  const destinationStatus = destinationType === "AQUARIUM"
    ? "IN_AQUARIUM"
    : destinationType === "STORAGE"
      ? "IN_STORAGE"
      : destinationType === "QUARANTINE"
        ? "IN_QUARANTINE"
        : destinationType;
  const destination = {
    aquariumId: destinationType === "AQUARIUM" ? toAquariumId : null,
    storageLocationId: destinationType === "STORAGE" ? toStorageLocationId : null,
    quarantineProjectId: destinationType === "QUARANTINE" ? toQuarantineProjectId : null,
    status: destinationStatus as never
  };

  const result = await prisma.$transaction(async (tx) => {
    let destinationItemId: string | null = itemId;
    if (fullTransfer) {
      await tx.aquariumItem.update({
        where: { id: itemId },
        data: {
          aquariumId: destination.aquariumId,
          storageLocationId: destination.storageLocationId,
          quarantineProjectId: destination.quarantineProjectId,
          status: destination.status
        }
      });
    } else {
      await tx.aquariumItem.update({ where: { id: itemId }, data: { quantity: item.quantity - quantity } });
      const destinationItem = await tx.aquariumItem.create({
        data: {
          collectionId: collection.id,
          aquariumId: destination.aquariumId,
          storageLocationId: destination.storageLocationId,
          quarantineProjectId: destination.quarantineProjectId,
          itemType: item.itemType,
          speciesDefinitionId: item.speciesDefinitionId,
          sourceId: item.sourceId,
          name: item.name,
          description: item.description,
          quantity,
          unit: item.unit,
          status: destination.status,
          acquiredFrom: item.acquiredFrom,
          purchasePrice: item.purchasePrice,
          acquiredAt: item.acquiredAt,
          notes: item.notes
        }
      });
      destinationItemId = destinationItem.id;
    }

    if (destinationType === "QUARANTINE" && toQuarantineProjectId && destinationItemId) {
      await tx.quarantineItem.create({
        data: {
          quarantineProjectId: toQuarantineProjectId,
          itemId: destinationItemId,
          quantity,
          notes: reason
        }
      });
    }

    return tx.itemTransfer.create({
      data: {
        itemId,
        destinationItemId: fullTransfer ? null : destinationItemId,
        fromAquariumId: item.aquariumId,
        toAquariumId: destination.aquariumId,
        fromStorageLocationId: item.storageLocationId,
        toStorageLocationId: destination.storageLocationId,
        fromQuarantineProjectId: item.quarantineProjectId,
        toQuarantineProjectId: destination.quarantineProjectId,
        quantity,
        reason,
        notes,
        metadata: { destinationType },
        createdById: user.id
      }
    });
  });

  for (const aquariumId of [item.aquariumId, destination.aquariumId].filter(Boolean) as string[]) {
    await prisma.aquariumEvent.create({
      data: {
        collectionId: collection.id,
        aquariumId,
        eventType: "TRANSFER",
        title: `Transferred ${item.name}`,
        relatedItemId: itemId,
        summary: reason ?? `Moved to ${destinationType.toLowerCase()}`,
        createdById: user.id
      }
    });
  }

  await writeAuditLog({ entityType: "AquariumItem", entityId: itemId, action: "TRANSFER", before: item, after: result, createdById: user.id });
  revalidatePath("/inventory");
  revalidatePath("/storage");
  revalidatePath("/quarantine");
  revalidatePath("/dashboard");
  if (item.aquariumId) revalidatePath(`/aquariums/${item.aquariumId}`);
  if (destination.aquariumId) revalidatePath(`/aquariums/${destination.aquariumId}`);
}

export async function attachEquipmentToAquarium(formData: FormData) {
  const { user, collection } = await getCollection();
  const aquariumId = String(formData.get("aquariumId"));
  const itemId = String(formData.get("itemId"));
  const [aquarium, item] = await Promise.all([
    prisma.aquarium.findFirstOrThrow({ where: { id: aquariumId, collectionId: collection.id } }),
    prisma.aquariumItem.findFirstOrThrow({ where: { id: itemId, collectionId: collection.id, aquariumId: null, itemType: "EQUIPMENT" } })
  ]);
  const before = item;
  await prisma.$transaction(async (tx) => {
    await tx.aquariumItem.update({
      where: { id: item.id },
      data: { aquariumId: aquarium.id, storageLocationId: null, quarantineProjectId: null, status: "IN_AQUARIUM" }
    });
    await tx.itemTransfer.create({
      data: {
        itemId: item.id,
        fromAquariumId: item.aquariumId,
        toAquariumId: aquarium.id,
        fromStorageLocationId: item.storageLocationId,
        fromQuarantineProjectId: item.quarantineProjectId,
        quantity: item.quantity,
        reason: "Attached from aquarium workspace",
        metadata: { destinationType: "AQUARIUM" },
        createdById: user.id
      }
    });
    await tx.aquariumEvent.create({
      data: {
        collectionId: collection.id,
        aquariumId: aquarium.id,
        relatedItemId: item.id,
        eventType: "EQUIPMENT_CHANGE",
        title: `Attached ${item.name}`,
        summary: "Equipment assigned to this aquarium.",
        createdById: user.id
      }
    });
  });
  await writeAuditLog({ entityType: "AquariumItem", entityId: item.id, action: "ATTACH_EQUIPMENT", before, after: { aquariumId }, createdById: user.id });
  revalidatePath(`/aquariums/${aquarium.id}`);
  revalidatePath("/equipment");
  revalidatePath("/inventory");
}

export async function detachEquipmentFromAquarium(formData: FormData) {
  const { user, collection } = await getCollection();
  const aquariumId = String(formData.get("aquariumId"));
  const itemId = String(formData.get("itemId"));
  const item = await prisma.aquariumItem.findFirstOrThrow({ where: { id: itemId, aquariumId, collectionId: collection.id, itemType: "EQUIPMENT" } });
  await prisma.$transaction(async (tx) => {
    await tx.aquariumLightingAssignment.deleteMany({ where: { aquariumId, equipmentItemId: item.id } });
    await tx.aquariumProfile.updateMany({ where: { aquariumId, lightItemId: item.id }, data: { lightItemId: null } });
    await tx.aquariumProfile.updateMany({ where: { aquariumId, heaterItemId: item.id }, data: { heaterItemId: null } });
    await tx.aquariumItem.update({ where: { id: item.id }, data: { aquariumId: null, status: "ACTIVE" } });
    await tx.itemTransfer.create({
      data: {
        itemId: item.id,
        fromAquariumId: aquariumId,
        quantity: item.quantity,
        reason: "Detached from aquarium workspace",
        metadata: { destinationType: "UNASSIGNED" },
        createdById: user.id
      }
    });
    await tx.aquariumEvent.create({
      data: {
        collectionId: collection.id,
        aquariumId,
        relatedItemId: item.id,
        eventType: "EQUIPMENT_CHANGE",
        title: `Detached ${item.name}`,
        summary: "Equipment returned to unassigned inventory.",
        createdById: user.id
      }
    });
  });
  await writeAuditLog({ entityType: "AquariumItem", entityId: item.id, action: "DETACH_EQUIPMENT", before: item, after: { aquariumId: null }, createdById: user.id });
  revalidatePath(`/aquariums/${aquariumId}`);
  revalidatePath("/equipment");
  revalidatePath("/inventory");
}

export async function createQuarantineProject(formData: FormData) {
  const { user, collection } = await getCollection();
  const aquariumId = text(formData, "aquariumId");
  if (aquariumId) await prisma.aquarium.findFirstOrThrow({ where: { id: aquariumId, collectionId: collection.id } });
  const project = await prisma.quarantineProject.create({
    data: {
      collectionId: collection.id,
      aquariumId,
      name: text(formData, "name") ?? "Quarantine project",
      reason: text(formData, "reason"),
      notes: text(formData, "notes")
    }
  });
  await writeAuditLog({ entityType: "QuarantineProject", entityId: project.id, action: "CREATE", after: project, createdById: user.id });
  revalidatePath("/quarantine");
}

export async function updateQuarantineProjectStatus(formData: FormData) {
  const { user, collection } = await getCollection();
  const id = String(formData.get("id"));
  const status = String(formData.get("status") ?? "COMPLETED");
  const before = await prisma.quarantineProject.findFirstOrThrow({ where: { id, collectionId: collection.id } });
  const project = await prisma.quarantineProject.update({
    where: { id },
    data: {
      status: status as never,
      completedAt: status === "COMPLETED" ? new Date() : null
    }
  });
  await writeAuditLog({ entityType: "QuarantineProject", entityId: id, action: "STATUS", before, after: project, createdById: user.id });
  revalidatePath("/quarantine");
  revalidatePath("/inventory");
}

export async function updateQuarantineItemStatus(formData: FormData) {
  const { user, collection } = await getCollection();
  const id = String(formData.get("id"));
  const status = String(formData.get("status") ?? "CLEARED");
  const before = await prisma.quarantineItem.findFirstOrThrow({
    where: { id, quarantineProject: { collectionId: collection.id } },
    include: { item: true }
  });
  const item = await prisma.quarantineItem.update({
    where: { id },
    data: {
      status: status as never,
      clearedAt: status === "CLEARED" ? new Date() : null,
      notes: text(formData, "notes") ?? before.notes
    }
  });
  if (status === "CLEARED") {
    await prisma.aquariumItem.update({ where: { id: before.itemId }, data: { status: "IN_STORAGE", quarantineProjectId: null } });
  }
  await writeAuditLog({ entityType: "QuarantineItem", entityId: id, action: "STATUS", before, after: item, createdById: user.id });
  revalidatePath("/quarantine");
  revalidatePath("/inventory");
}

export async function createEquipment(formData: FormData) {
  const { user, collection } = await getCollection();
  const equipmentType = String(formData.get("equipmentType") ?? "OTHER");
  const lightCapabilityProfileId = equipmentType === "LIGHT" ? text(formData, "lightCapabilityProfileId") : null;
  if (lightCapabilityProfileId) {
    await prisma.lightCapabilityProfile.findFirstOrThrow({ where: { id: lightCapabilityProfileId, collectionId: collection.id } });
  }
  const item = await prisma.aquariumItem.create({
    data: {
      collectionId: collection.id,
      aquariumId: text(formData, "aquariumId"),
      itemType: "EQUIPMENT",
      name: text(formData, "name") ?? "Unnamed equipment",
      quantity: 1,
      sourceId: text(formData, "sourceId"),
      purchasePrice: decimalString(formData, "purchasePrice"),
      notes: text(formData, "notes"),
      equipmentProfile: {
        create: {
          equipmentType: equipmentType as never,
          lightCapabilityProfileId,
          brand: text(formData, "brand"),
          model: text(formData, "model"),
          serialNumber: text(formData, "serialNumber"),
          purchaseDate: dateValue(formData, "purchaseDate"),
          warrantyUntil: dateValue(formData, "warrantyUntil"),
          maintenanceIntervalDays: numberValue(formData, "maintenanceIntervalDays"),
          lastMaintainedAt: dateValue(formData, "lastMaintainedAt"),
          notes: null
        }
      }
    }
  });
  await writeAuditLog({ entityType: "EquipmentProfile", entityId: item.id, action: "CREATE", after: item, createdById: user.id });
  revalidatePath("/equipment");
  revalidatePath("/inventory");
}

export async function updateEquipment(formData: FormData) {
  const { user, collection } = await getCollection();
  const itemId = String(formData.get("itemId"));
  const equipmentType = String(formData.get("equipmentType") ?? "OTHER");
  const lightCapabilityProfileId = equipmentType === "LIGHT" ? text(formData, "lightCapabilityProfileId") : null;
  if (lightCapabilityProfileId) {
    await prisma.lightCapabilityProfile.findFirstOrThrow({ where: { id: lightCapabilityProfileId, collectionId: collection.id } });
  }
  const before = await prisma.aquariumItem.findFirstOrThrow({
    where: { id: itemId, collectionId: collection.id, itemType: "EQUIPMENT" },
    include: { equipmentProfile: true }
  });
  const item = await prisma.aquariumItem.update({
    where: { id: itemId },
    data: {
      name: text(formData, "name") ?? before.name,
      aquariumId: text(formData, "aquariumId"),
      sourceId: text(formData, "sourceId"),
      purchasePrice: decimalString(formData, "purchasePrice"),
      notes: text(formData, "notes"),
      equipmentProfile: {
        upsert: {
          create: {
            equipmentType: equipmentType as never,
            lightCapabilityProfileId,
            brand: text(formData, "brand"),
            model: text(formData, "model"),
            serialNumber: text(formData, "serialNumber"),
            purchaseDate: dateValue(formData, "purchaseDate"),
            warrantyUntil: dateValue(formData, "warrantyUntil"),
            maintenanceIntervalDays: numberValue(formData, "maintenanceIntervalDays"),
            lastMaintainedAt: dateValue(formData, "lastMaintainedAt"),
            notes: null
          },
          update: {
            equipmentType: equipmentType as never,
            lightCapabilityProfileId,
            brand: text(formData, "brand"),
            model: text(formData, "model"),
            serialNumber: text(formData, "serialNumber"),
            purchaseDate: dateValue(formData, "purchaseDate"),
            warrantyUntil: dateValue(formData, "warrantyUntil"),
            maintenanceIntervalDays: numberValue(formData, "maintenanceIntervalDays"),
            lastMaintainedAt: dateValue(formData, "lastMaintainedAt"),
            notes: null
          }
        }
      }
    },
    include: { equipmentProfile: true }
  });
  await writeAuditLog({ entityType: "EquipmentProfile", entityId: itemId, action: "UPDATE", before, after: item, createdById: user.id });
  revalidatePath("/equipment");
  revalidatePath("/inventory");
}

export async function markEquipmentMaintained(formData: FormData) {
  const { user, collection } = await getCollection();
  const itemId = String(formData.get("itemId"));
  const item = await prisma.aquariumItem.findFirstOrThrow({ where: { id: itemId, collectionId: collection.id }, include: { equipmentProfile: true } });
  const profile = await prisma.equipmentProfile.update({
    where: { itemId },
    data: { lastMaintainedAt: new Date() }
  });
  if (item.aquariumId) {
    await prisma.aquariumEvent.create({
      data: {
        collectionId: collection.id,
        aquariumId: item.aquariumId,
        eventType: "EQUIPMENT_MAINTENANCE",
        title: `Maintained ${item.name}`,
        relatedItemId: item.id,
        createdById: user.id
      }
    });
  }
  await writeAuditLog({ entityType: "EquipmentProfile", entityId: profile.id, action: "MARK_MAINTAINED", before: item.equipmentProfile, after: profile, createdById: user.id });
  revalidatePath("/equipment");
}

export async function createLocation(formData: FormData) {
  const { user, collection } = await getCollection();
  const location = await prisma.location.create({
    data: {
      collectionId: collection.id,
      parentId: text(formData, "parentId"),
      name: text(formData, "name") ?? "Unnamed location",
      type: String(formData.get("type") ?? "OTHER") as never,
      description: text(formData, "description"),
      sortOrder: numberValue(formData, "sortOrder") ?? 0
    }
  });
  await writeAuditLog({ entityType: "Location", entityId: location.id, action: "CREATE", after: location, createdById: user.id });
  revalidatePath("/settings");
  revalidatePath("/collection");
  revalidatePath("/aquariums");
}

export async function updateLocation(formData: FormData) {
  const { user, collection } = await getCollection();
  const id = String(formData.get("id"));
  const before = await prisma.location.findFirstOrThrow({ where: { id, collectionId: collection.id } });
  const location = await prisma.location.update({
    where: { id },
    data: {
      parentId: text(formData, "parentId"),
      name: text(formData, "name") ?? before.name,
      type: String(formData.get("type") ?? before.type) as never,
      description: text(formData, "description"),
      sortOrder: numberValue(formData, "sortOrder") ?? before.sortOrder
    }
  });
  await writeAuditLog({ entityType: "Location", entityId: location.id, action: "UPDATE", before, after: location, createdById: user.id });
  revalidatePath("/collection");
  revalidatePath("/aquariums");
}

export async function deleteLocation(formData: FormData) {
  const { user, collection } = await getCollection();
  const id = String(formData.get("id"));
  const before = await prisma.location.findFirstOrThrow({ where: { id, collectionId: collection.id } });
  await prisma.location.delete({ where: { id } });
  await writeAuditLog({ entityType: "Location", entityId: id, action: "DELETE", before, createdById: user.id });
  revalidatePath("/collection");
  revalidatePath("/aquariums");
}

export async function createStorageLocation(formData: FormData) {
  formData.set("type", String(formData.get("type") || "BIN"));
  await createLocation(formData);
  revalidatePath("/storage");
}

export async function updateStorageLocation(formData: FormData) {
  await updateLocation(formData);
  revalidatePath("/storage");
}

export async function deleteStorageLocation(formData: FormData) {
  const { collection } = await getCollection();
  const id = String(formData.get("id"));
  const used = await prisma.aquariumItem.count({ where: { collectionId: collection.id, storageLocationId: id } });
  if (used > 0) throw new Error("Move stored items out of this location before deleting it.");
  await deleteLocation(formData);
  revalidatePath("/storage");
}

export async function createSource(formData: FormData) {
  const { user, collection } = await getCollection();
  const source = await prisma.source.create({
    data: {
      collectionId: collection.id,
      name: text(formData, "name") ?? "Unnamed source",
      type: String(formData.get("type") ?? "OTHER") as never,
      website: text(formData, "website"),
      notes: text(formData, "notes")
    }
  });
  await writeAuditLog({ entityType: "Source", entityId: source.id, action: "CREATE", after: source, createdById: user.id });
  revalidatePath("/settings");
  revalidatePath("/collection");
  revalidatePath("/inventory");
  revalidatePath("/equipment");
}

export async function updateSource(formData: FormData) {
  const { user, collection } = await getCollection();
  const id = String(formData.get("id"));
  const before = await prisma.source.findFirstOrThrow({ where: { id, collectionId: collection.id } });
  const source = await prisma.source.update({
    where: { id },
    data: {
      name: text(formData, "name") ?? before.name,
      type: String(formData.get("type") ?? before.type) as never,
      website: text(formData, "website"),
      notes: text(formData, "notes")
    }
  });
  await writeAuditLog({ entityType: "Source", entityId: source.id, action: "UPDATE", before, after: source, createdById: user.id });
  revalidatePath("/collection");
  revalidatePath("/inventory");
  revalidatePath("/equipment");
}

export async function deleteSource(formData: FormData) {
  const { user, collection } = await getCollection();
  const id = String(formData.get("id"));
  const before = await prisma.source.findFirstOrThrow({ where: { id, collectionId: collection.id } });
  await prisma.source.delete({ where: { id } });
  await writeAuditLog({ entityType: "Source", entityId: id, action: "DELETE", before, createdById: user.id });
  revalidatePath("/collection");
  revalidatePath("/inventory");
  revalidatePath("/equipment");
}

export async function sendCollectionInvitation(formData: FormData) {
  const { user, collection } = await getCollection();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "VIEWER");
  if (!email) throw new Error("Invitation email is required.");

  const token = randomBytes(32).toString("base64url");
  const invitation = await prisma.collectionInvitation.create({
    data: {
      collectionId: collection.id,
      email,
      role: role as never,
      tokenHash: hashToken(token),
      inviterId: user.id,
      expiresAt: addDays(new Date(), 14)
    }
  });

  await sendEmail({
    ...invitationEmail({
      collectionName: collection.name,
      inviterName: user.name,
      role,
      acceptUrl: appUrl(`/invite/${token}`)
    }),
    to: email,
    collectionId: collection.id,
    userId: user.id,
    template: "collection-invitation",
    entityType: "CollectionInvitation",
    entityId: invitation.id
  });

  await writeAuditLog({
    entityType: "CollectionInvitation",
    entityId: invitation.id,
    action: "SEND",
    after: { email, role },
    createdById: user.id
  });
  revalidatePath("/settings");
}

export async function createCareSchedule(formData: FormData) {
  const { user, collection } = await getCollection();
  const aquariumId = text(formData, "aquariumId");
  if (aquariumId) {
    await prisma.aquarium.findFirstOrThrow({ where: { id: aquariumId, collectionId: collection.id } });
  }
  const startDate = dateValue(formData, "startDate") ?? new Date();
  const cadenceType = String(formData.get("cadenceType") ?? "WEEKLY");
  const intervalDays = numberValue(formData, "intervalDays");
  const dayOfMonth = numberValue(formData, "dayOfMonth");
  const schedule = await prisma.careSchedule.create({
    data: {
      collectionId: collection.id,
      aquariumId,
      name: text(formData, "name") ?? "Care schedule",
      description: text(formData, "description"),
      scheduleType: String(formData.get("scheduleType") ?? "MAINTENANCE") as never,
      cadenceType: cadenceType as never,
      intervalDays,
      daysOfWeek: text(formData, "daysOfWeek") ? text(formData, "daysOfWeek")?.split(",").map((day) => day.trim()).filter(Boolean) : undefined,
      dayOfMonth,
      startDate,
      endDate: dateValue(formData, "endDate"),
      nextDueAt: startDate,
      enabled: String(formData.get("enabled") ?? "on") !== "off"
    }
  });
  await createPendingTaskForSchedule(schedule);
  await writeAuditLog({ entityType: "CareSchedule", entityId: schedule.id, action: "CREATE", after: schedule, createdById: user.id });
  revalidatePath("/schedules");
  revalidatePath("/dashboard");
  if (aquariumId) revalidatePath(`/aquariums/${aquariumId}`);
}

export async function completeCareTask(formData: FormData) {
  const { user, collection } = await getCollection();
  const id = String(formData.get("id"));
  const createEvent = String(formData.get("createEvent") ?? "on") !== "off";
  const before = await prisma.careTask.findFirstOrThrow({
    where: { id, careSchedule: { collectionId: collection.id } },
    include: { careSchedule: true, aquarium: true }
  });
  const completedAt = new Date();
  let relatedEventId: string | null = null;
  if (createEvent && before.aquariumId) {
    const eventType = before.careSchedule.scheduleType === "FEEDING"
      ? "FEEDING"
      : before.careSchedule.scheduleType === "TESTING"
        ? "TEST_RESULT"
        : before.careSchedule.scheduleType === "WATER_CHANGE"
          ? "WATER_CHANGE"
          : "MAINTENANCE";
    const event = await prisma.aquariumEvent.create({
      data: {
        collectionId: collection.id,
        aquariumId: before.aquariumId,
        eventType: eventType as never,
        title: before.title,
        summary: before.description,
        eventDate: completedAt,
        createdById: user.id
      }
    });
    relatedEventId = event.id;
  }
  const task = await prisma.careTask.update({
    where: { id },
    data: {
      status: "COMPLETED",
      completedAt,
      completedById: user.id,
      relatedEventId
    }
  });

  const nextDueAt = nextDueDate(before.dueAt, before.careSchedule.cadenceType, before.careSchedule.intervalDays, before.careSchedule.dayOfMonth);
  if (nextDueAt && (!before.careSchedule.endDate || nextDueAt <= before.careSchedule.endDate) && before.careSchedule.enabled) {
    const schedule = await prisma.careSchedule.update({
      where: { id: before.careScheduleId },
      data: { nextDueAt },
    });
    await createPendingTaskForSchedule(schedule);
  } else {
    await prisma.careSchedule.update({ where: { id: before.careScheduleId }, data: { nextDueAt: null } });
  }

  await writeAuditLog({ entityType: "CareTask", entityId: id, action: "COMPLETE", before, after: task, createdById: user.id });
  revalidatePath("/schedules");
  revalidatePath("/dashboard");
  if (before.aquariumId) revalidatePath(`/aquariums/${before.aquariumId}`);
}

export async function skipCareTask(formData: FormData) {
  const { user, collection } = await getCollection();
  const id = String(formData.get("id"));
  const before = await prisma.careTask.findFirstOrThrow({
    where: { id, careSchedule: { collectionId: collection.id } },
    include: { careSchedule: true }
  });
  const task = await prisma.careTask.update({
    where: { id },
    data: { status: "SKIPPED", skippedAt: new Date() }
  });
  const nextDueAt = nextDueDate(before.dueAt, before.careSchedule.cadenceType, before.careSchedule.intervalDays, before.careSchedule.dayOfMonth);
  if (nextDueAt && before.careSchedule.enabled) {
    const schedule = await prisma.careSchedule.update({ where: { id: before.careScheduleId }, data: { nextDueAt } });
    await createPendingTaskForSchedule(schedule);
  }
  await writeAuditLog({ entityType: "CareTask", entityId: id, action: "SKIP", before, after: task, createdById: user.id });
  revalidatePath("/schedules");
  revalidatePath("/dashboard");
  if (before.aquariumId) revalidatePath(`/aquariums/${before.aquariumId}`);
}

export async function logFeeding(formData: FormData) {
  const { user, collection } = await getCollection();
  const aquariumId = String(formData.get("aquariumId"));
  const foodItemId = text(formData, "foodItemId");
  const targetItemId = text(formData, "targetItemId");
  await prisma.aquarium.findFirstOrThrow({ where: { id: aquariumId, collectionId: collection.id } });
  if (foodItemId) {
    await prisma.aquariumItem.findFirstOrThrow({ where: { id: foodItemId, collectionId: collection.id, itemType: "FOOD" } });
  }
  if (targetItemId) {
    await prisma.aquariumItem.findFirstOrThrow({ where: { id: targetItemId, aquariumId, collectionId: collection.id } });
  }
  const foodItem = foodItemId ? await prisma.aquariumItem.findUnique({ where: { id: foodItemId } }) : null;
  const amount = text(formData, "amount");
  const targets = text(formData, "targetInhabitants");
  const fedAt = dateValue(formData, "fedAt") ?? new Date();
  const event = await prisma.aquariumEvent.create({
    data: {
      collectionId: collection.id,
      aquariumId,
      relatedItemId: foodItemId,
      eventType: "FEEDING",
      title: text(formData, "title") ?? "Feeding",
      summary: [amount ? `Amount: ${amount}` : null, targets ? `Targets: ${targets}` : null].filter(Boolean).join(" · ") || null,
      notes: text(formData, "notes"),
      eventDate: fedAt,
      createdById: user.id
    }
  });
  await prisma.feedingEvent.create({
    data: {
      aquariumEventId: event.id,
      aquariumId,
      foodItemId,
      targetItemId,
      foodNameSnapshot: foodItem?.name ?? text(formData, "foodName"),
      amount,
      target: targets,
      notes: text(formData, "notes")
    }
  });
  await writeAuditLog({ entityType: "AquariumEvent", entityId: event.id, action: "LOG_FEEDING", after: event, createdById: user.id });
  revalidatePath(`/aquariums/${aquariumId}`);
  revalidatePath("/dashboard");
}

export async function createAquariumEvent(formData: FormData) {
  const { user, collection } = await getCollection();
  const aquariumId = String(formData.get("aquariumId"));
  await prisma.aquarium.findFirstOrThrow({ where: { id: aquariumId, collectionId: collection.id } });
  const eventType = String(formData.get("eventType") ?? "NOTE");
  const relatedItemId = text(formData, "relatedItemId");
  if (relatedItemId) {
    await prisma.aquariumItem.findFirstOrThrow({ where: { id: relatedItemId, collectionId: collection.id } });
  }
  const event = await prisma.aquariumEvent.create({
    data: {
      collectionId: collection.id,
      aquariumId,
      eventType: eventType as never,
      relatedItemId,
      title: text(formData, "title") ?? eventType,
      summary: text(formData, "summary"),
      notes: text(formData, "notes"),
      maintenanceType: text(formData, "maintenanceType"),
      waterChangePercent: numberValue(formData, "waterChangePercent"),
      waterChangeGallons: numberValue(formData, "waterChangeGallons"),
      eventDate: dateValue(formData, "eventDate") ?? new Date(),
      createdById: user.id
    }
  });

  const parameter = text(formData, "parameter");
  const value = numberValue(formData, "value");
  const unit = text(formData, "unit");
  if (eventType === "TEST_RESULT" && parameter && value !== null && unit) {
    await prisma.waterParameterReading.create({
      data: {
        aquariumId,
        parameter: parameter as never,
        value,
        unit,
        measuredAt: event.eventDate,
        notes: text(formData, "notes")
      }
    });
  }

  await writeAuditLog({ entityType: "AquariumEvent", entityId: event.id, action: "CREATE", after: event, createdById: user.id });
  revalidatePath(`/aquariums/${aquariumId}`);
  revalidatePath("/dashboard");
}

export async function createMaintenanceEvent(formData: FormData) {
  const { user, collection } = await getCollection();
  const aquariumId = String(formData.get("aquariumId"));
  await prisma.aquarium.findFirstOrThrow({ where: { id: aquariumId, collectionId: collection.id } });
  const equipmentItemId = text(formData, "equipmentItemId");
  if (equipmentItemId) {
    await prisma.aquariumItem.findFirstOrThrow({ where: { id: equipmentItemId, collectionId: collection.id, itemType: "EQUIPMENT" } });
  }
  const maintenanceType = String(formData.get("maintenanceType") ?? "OTHER");
  const eventDate = dateValue(formData, "eventDate") ?? new Date();
  const event = await prisma.aquariumEvent.create({
    data: {
      collectionId: collection.id,
      aquariumId,
      relatedItemId: equipmentItemId,
      eventType: maintenanceType === "WATER_CHANGE" ? "WATER_CHANGE" : "MAINTENANCE",
      title: text(formData, "title") ?? `Maintenance: ${maintenanceType.replaceAll("_", " ").toLowerCase()}`,
      summary: text(formData, "summary"),
      notes: text(formData, "notes"),
      maintenanceType,
      eventDate,
      createdById: user.id
    }
  });
  await prisma.maintenanceEvent.create({
    data: {
      aquariumEventId: event.id,
      aquariumId,
      maintenanceType: maintenanceType as never,
      equipmentItemId,
      summary: text(formData, "summary"),
      notes: text(formData, "notes")
    }
  });
  if (equipmentItemId && String(formData.get("markMaintained") ?? "on") !== "off") {
    await prisma.equipmentProfile.updateMany({ where: { itemId: equipmentItemId }, data: { lastMaintainedAt: eventDate } });
  }
  await writeAuditLog({ entityType: "AquariumEvent", entityId: event.id, action: "LOG_MAINTENANCE", after: event, createdById: user.id });
  revalidatePath(`/aquariums/${aquariumId}`);
  revalidatePath("/equipment");
  revalidatePath("/dashboard");
}

export async function logWaterChange(formData: FormData) {
  const { user, collection } = await getCollection();
  const aquariumId = String(formData.get("aquariumId"));
  await prisma.aquarium.findFirstOrThrow({ where: { id: aquariumId, collectionId: collection.id } });
  const eventDate = dateValue(formData, "eventDate") ?? new Date();
  const gallons = numberValue(formData, "volumeGallons");
  const percent = numberValue(formData, "percentChanged");
  const event = await prisma.aquariumEvent.create({
    data: {
      collectionId: collection.id,
      aquariumId,
      eventType: "WATER_CHANGE",
      title: text(formData, "title") ?? "Water change",
      summary: [gallons !== null ? `${gallons} gal` : null, percent !== null ? `${percent}%` : null, text(formData, "waterSource")].filter(Boolean).join(" · ") || null,
      notes: text(formData, "notes"),
      maintenanceType: "WATER_CHANGE",
      waterChangeGallons: gallons,
      waterChangePercent: percent,
      eventDate,
      createdById: user.id
    }
  });
  await prisma.waterChangeEvent.create({
    data: {
      aquariumEventId: event.id,
      aquariumId,
      volumeGallons: gallons,
      percentChanged: percent,
      waterSource: text(formData, "waterSource"),
      conditionerUsed: text(formData, "conditionerUsed"),
      temperatureMatched: formData.get("temperatureMatched") === "on",
      beforeNotes: text(formData, "beforeNotes"),
      afterNotes: text(formData, "afterNotes"),
      parameterNotes: text(formData, "parameterNotes"),
      notes: text(formData, "notes")
    }
  });
  await writeAuditLog({ entityType: "AquariumEvent", entityId: event.id, action: "LOG_WATER_CHANGE", after: event, createdById: user.id });
  revalidatePath(`/aquariums/${aquariumId}`);
  revalidatePath("/dashboard");
}

export async function addInhabitant(formData: FormData) {
  const { user, collection } = await getCollection();
  const aquariumId = String(formData.get("aquariumId"));
  await prisma.aquarium.findFirstOrThrow({ where: { id: aquariumId, collectionId: collection.id } });
  const speciesDefinitionId = text(formData, "speciesDefinitionId");
  if (speciesDefinitionId) await prisma.speciesDefinition.findFirstOrThrow({ where: { id: speciesDefinitionId, OR: [{ collectionId: collection.id }, { collectionId: null }] } });
  const itemType = String(formData.get("itemType") ?? "FISH");
  const quantity = numberValue(formData, "quantity") ?? 1;
  const name = text(formData, "name") ?? "Unnamed inhabitant";
  const existingItemId = text(formData, "existingItemId");
  const item = existingItemId
    ? await prisma.aquariumItem.update({
        where: { id: existingItemId },
        data: { quantity: { increment: quantity }, status: "ACTIVE" }
      })
    : await prisma.aquariumItem.create({
        data: {
          collectionId: collection.id,
          aquariumId,
          itemType: itemType as never,
          speciesDefinitionId,
          sourceId: text(formData, "sourceId"),
          name,
          quantity,
          unit: text(formData, "unit") ?? (itemType === "PLANT" ? "plants" : "fish"),
          purchasePrice: decimalString(formData, "purchasePrice"),
          acquiredAt: dateValue(formData, "acquiredAt"),
          notes: text(formData, "notes")
        }
      });
  const eventType = itemType === "PLANT" ? "PLANT_ADDITION" : "LIVESTOCK_ADDITION";
  const event = await prisma.aquariumEvent.create({
    data: {
      collectionId: collection.id,
      aquariumId,
      relatedItemId: item.id,
      relatedSpeciesId: speciesDefinitionId,
      eventType,
      title: `Added ${quantity} ${item.name}`,
      summary: text(formData, "sourceId") ? "Source linked in inventory record." : null,
      notes: text(formData, "notes"),
      eventDate: dateValue(formData, "acquiredAt") ?? new Date(),
      createdById: user.id,
      metadata: { quantity, itemType }
    }
  });
  await writeAuditLog({ entityType: "AquariumItem", entityId: item.id, action: eventType, after: { item, event }, createdById: user.id });
  revalidatePath(`/aquariums/${aquariumId}`);
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
}

export async function logInhabitantLoss(formData: FormData) {
  const { user, collection } = await getCollection();
  const aquariumId = String(formData.get("aquariumId"));
  const itemId = String(formData.get("itemId") ?? "");
  const item = await prisma.aquariumItem.findFirstOrThrow({ where: { id: itemId, aquariumId, collectionId: collection.id } });
  const quantity = Math.max(numberValue(formData, "quantity") ?? 1, 0);
  const remaining = Math.max(item.quantity - quantity, 0);
  const removeFromInventory = String(formData.get("removeFromInventory") ?? "on") !== "off";
  const status = remaining <= 0 && removeFromInventory ? (item.itemType === "PLANT" ? "REMOVED" : "DEAD") : item.status;
  const updated = await prisma.aquariumItem.update({ where: { id: item.id }, data: { quantity: remaining, status } });
  const eventType = item.itemType === "PLANT" ? "PLANT_REMOVAL" : "LIVESTOCK_LOSS";
  const event = await prisma.aquariumEvent.create({
    data: {
      collectionId: collection.id,
      aquariumId,
      relatedItemId: item.id,
      relatedSpeciesId: item.speciesDefinitionId,
      eventType,
      title: `${item.itemType === "PLANT" ? "Removed" : "Lost"} ${quantity} ${item.name}`,
      summary: text(formData, "suspectedCause"),
      notes: text(formData, "notes"),
      eventDate: dateValue(formData, "eventDate") ?? new Date(),
      createdById: user.id,
      metadata: { quantity, remaining, removeFromInventory }
    }
  });
  await writeAuditLog({ entityType: "AquariumItem", entityId: item.id, action: eventType, before: item, after: { item: updated, event }, createdById: user.id });
  revalidatePath(`/aquariums/${aquariumId}`);
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
}

export async function createMedicationDefinition(formData: FormData) {
  const { user, collection } = await getCollection();
  const definition = await prisma.medicationDefinition.create({
    data: {
      collectionId: collection.id,
      name: text(formData, "name") ?? "Unnamed medication",
      manufacturer: text(formData, "manufacturer"),
      medicationType: String(formData.get("medicationType") ?? "OTHER") as never,
      activeIngredients: text(formData, "activeIngredients"),
      concentration: text(formData, "concentration"),
      defaultDoseAmount: numberValue(formData, "defaultDoseAmount"),
      defaultDoseUnit: text(formData, "defaultDoseUnit"),
      dosePerGallons: String(formData.get("doseVolumeUnit")) === "LITER" ? null : numberValue(formData, "dosePerVolume"),
      dosePerVolume: numberValue(formData, "dosePerVolume"),
      doseVolumeUnit: String(formData.get("doseVolumeUnit") ?? "GALLON") as never,
      repeatIntervalHours: numberValue(formData, "repeatIntervalHours"),
      courseLengthDays: numberValue(formData, "courseLengthDays"),
      waterChangeGuidance: text(formData, "waterChangeGuidance"),
      scheduleNotes: text(formData, "scheduleNotes"),
      safetyNotes: text(formData, "safetyNotes"),
      contraindications: text(formData, "contraindications")
    }
  });
  await writeAuditLog({ entityType: "MedicationDefinition", entityId: definition.id, action: "CREATE", after: definition, createdById: user.id });
  revalidatePath("/medications");
}

export async function updateMedicationDefinition(formData: FormData) {
  const { user, collection } = await getCollection();
  const id = String(formData.get("id"));
  const before = await prisma.medicationDefinition.findFirstOrThrow({ where: { id, collectionId: collection.id } });
  const definition = await prisma.medicationDefinition.update({
    where: { id },
    data: {
      name: text(formData, "name") ?? before.name,
      manufacturer: text(formData, "manufacturer"),
      medicationType: String(formData.get("medicationType") ?? before.medicationType) as never,
      activeIngredients: text(formData, "activeIngredients"),
      concentration: text(formData, "concentration"),
      defaultDoseAmount: numberValue(formData, "defaultDoseAmount"),
      defaultDoseUnit: text(formData, "defaultDoseUnit"),
      dosePerGallons: String(formData.get("doseVolumeUnit")) === "LITER" ? null : numberValue(formData, "dosePerVolume"),
      dosePerVolume: numberValue(formData, "dosePerVolume"),
      doseVolumeUnit: String(formData.get("doseVolumeUnit") ?? "GALLON") as never,
      repeatIntervalHours: numberValue(formData, "repeatIntervalHours"),
      courseLengthDays: numberValue(formData, "courseLengthDays"),
      waterChangeGuidance: text(formData, "waterChangeGuidance"),
      scheduleNotes: text(formData, "scheduleNotes"),
      safetyNotes: text(formData, "safetyNotes"),
      contraindications: text(formData, "contraindications")
    }
  });
  await writeAuditLog({ entityType: "MedicationDefinition", entityId: definition.id, action: "UPDATE", before, after: definition, createdById: user.id });
  revalidatePath("/medications");
}

export async function deleteMedicationDefinition(formData: FormData) {
  const { user, collection } = await getCollection();
  const id = String(formData.get("id"));
  const inUse = await prisma.medicationCourse.count({ where: { medicationDefinitionId: id, collectionId: collection.id } });
  if (inUse > 0) throw new Error("This medication has courses and cannot be deleted.");
  const before = await prisma.medicationDefinition.findFirstOrThrow({ where: { id, collectionId: collection.id } });
  await prisma.medicationDefinition.delete({ where: { id } });
  await writeAuditLog({ entityType: "MedicationDefinition", entityId: id, action: "DELETE", before, createdById: user.id });
  revalidatePath("/medications");
}

export async function startMedicationCourse(formData: FormData) {
  const { user, collection } = await getCollection();
  const aquariumId = String(formData.get("aquariumId"));
  const medicationDefinitionId = String(formData.get("medicationDefinitionId"));
  const aquarium = await prisma.aquarium.findFirstOrThrow({ where: { id: aquariumId, collectionId: collection.id } });
  const definition = await prisma.medicationDefinition.findFirstOrThrow({ where: { id: medicationDefinitionId, collectionId: collection.id } });
  const { convertVolume } = await import("@/lib/units/volume");
  const tankVolume = numberValue(formData, "tankVolume") ?? aquarium.volumeGallons;
  const tankUnit = String(formData.get("tankVolumeUnit") ?? aquarium.volumeUnit ?? "GALLON") as "GALLON" | "LITER";
  const tankVolumeGallons = tankVolume ? convertVolume(tankVolume, tankUnit, "GALLON") : null;
  if (!tankVolumeGallons) throw new Error("Tank volume is required to calculate or confirm medication dose.");
  if (!tankVolume) throw new Error("Tank volume is required to calculate or confirm medication dose.");
  const doseBasis = definition.dosePerVolume ?? definition.dosePerGallons;
  const volumeInDoseUnit = convertVolume(tankVolume, tankUnit, definition.doseVolumeUnit);
  const calculatedDoseAmount = definition.defaultDoseAmount && doseBasis
    ? (volumeInDoseUnit / doseBasis) * definition.defaultDoseAmount
    : null;
  const actualDoseAmount = numberValue(formData, "actualDoseAmount") ?? calculatedDoseAmount;
  const actualDoseUnit = text(formData, "actualDoseUnit") ?? definition.defaultDoseUnit;
  if (actualDoseAmount === null || actualDoseAmount <= 0 || !actualDoseUnit) throw new Error("Confirm a positive dose amount and unit before starting treatment.");
  const doseType = String(formData.get("doseType") ?? "TREATMENT_START") === "ONE_OFF" ? "ONE_OFF" : "TREATMENT_START";
  const startedAt = dateValue(formData, "startedAt") ?? new Date();
  const course = await prisma.medicationCourse.create({
    data: {
      collectionId: collection.id,
      aquariumId,
      medicationDefinitionId,
      title: text(formData, "title") ?? (doseType === "ONE_OFF" ? `${definition.name} one-off dose` : `${definition.name} course`),
      reason: text(formData, "reason"),
      tankVolumeGallons,
      calculatedDoseAmount,
      calculatedDoseUnit: definition.defaultDoseUnit,
      doseSchedule: {
        notes: text(formData, "doseSchedule") ?? definition.scheduleNotes,
        repeatIntervalHours: definition.repeatIntervalHours,
        courseLengthDays: definition.courseLengthDays,
        waterChangeGuidance: definition.waterChangeGuidance
      },
      startedAt,
      status: doseType === "ONE_OFF" ? "COMPLETED" : "ACTIVE",
      completedAt: doseType === "ONE_OFF" ? startedAt : null,
      notes: text(formData, "notes")
    }
  });
  const event = await prisma.aquariumEvent.create({
    data: {
      collectionId: collection.id,
      aquariumId,
      relatedMedicationCourseId: course.id,
      eventType: "MEDICATION",
      title: doseType === "ONE_OFF" ? `Dosed ${definition.name}` : `Started ${course.title}`,
      summary: [doseType === "ONE_OFF" ? "one-off dose" : "treatment start", definition.name, `${Number(actualDoseAmount.toFixed(2))}${actualDoseUnit}`].filter(Boolean).join(" · "),
      notes: "Verify medication label directions before dosing.",
      eventDate: startedAt,
      createdById: user.id,
      metadata: { medicationDefinitionId, tankVolumeGallons, calculatedDoseAmount, calculatedDoseUnit: course.calculatedDoseUnit, actualDoseAmount, actualDoseUnit }
    }
  });
  await prisma.medicationDoseEvent.create({
    data: {
      aquariumEventId: event.id,
      medicationCourseId: course.id,
      doseAmount: actualDoseAmount,
      doseUnit: actualDoseUnit,
      recommendedDoseAmount: calculatedDoseAmount,
      recommendedDoseUnit: course.calculatedDoseUnit,
      doseType,
      doseNumber: 1,
      dosedAt: startedAt,
      notes: text(formData, "notes")
    }
  });
  await writeAuditLog({ entityType: "MedicationCourse", entityId: course.id, action: "START", after: { course, event }, createdById: user.id });
  revalidatePath(`/aquariums/${aquariumId}`);
  revalidatePath("/medications");
  revalidatePath("/dashboard");
}

export async function logMedicationDose(formData: FormData) {
  const { user, collection } = await getCollection();
  const medicationCourseId = String(formData.get("medicationCourseId"));
  const course = await prisma.medicationCourse.findFirstOrThrow({
    where: { id: medicationCourseId, collectionId: collection.id },
    include: { medicationDefinition: true }
  });
  const dosedAt = dateValue(formData, "dosedAt") ?? new Date();
  const doseAmount = numberValue(formData, "doseAmount") ?? course.calculatedDoseAmount;
  const doseUnit = text(formData, "doseUnit") ?? course.calculatedDoseUnit;
  const requestedDoseType = String(formData.get("doseType") ?? "FOLLOW_UP");
  const doseType = ["ONE_OFF", "FOLLOW_UP", "TREATMENT_COMPLETION"].includes(requestedDoseType) ? requestedDoseType : "FOLLOW_UP";
  const event = await prisma.aquariumEvent.create({
    data: {
      collectionId: collection.id,
      aquariumId: course.aquariumId,
      relatedMedicationCourseId: course.id,
      eventType: "MEDICATION",
      title: doseType === "TREATMENT_COMPLETION" ? `Completed treatment with ${course.medicationDefinition.name}` : `Dosed ${course.medicationDefinition.name}`,
      summary: [doseType.replaceAll("_", " ").toLowerCase(), doseAmount !== null ? `${Number(doseAmount.toFixed(2))}${doseUnit ?? ""}` : null].filter(Boolean).join(" · "),
      notes: text(formData, "notes"),
      eventDate: dosedAt,
      createdById: user.id
    }
  });
  const dose = await prisma.medicationDoseEvent.create({
    data: {
      aquariumEventId: event.id,
      medicationCourseId: course.id,
      doseAmount,
      doseUnit,
      recommendedDoseAmount: course.calculatedDoseAmount,
      recommendedDoseUnit: course.calculatedDoseUnit,
      doseType: doseType as never,
      doseNumber: numberValue(formData, "doseNumber"),
      dosedAt,
      notes: text(formData, "notes")
    }
  });
  if (doseType === "TREATMENT_COMPLETION") {
    await prisma.medicationCourse.update({ where: { id: course.id }, data: { status: "COMPLETED", completedAt: dosedAt } });
  }
  await writeAuditLog({ entityType: "MedicationDoseEvent", entityId: dose.id, action: "CREATE", after: { dose, event }, createdById: user.id });
  revalidatePath(`/aquariums/${course.aquariumId}`);
  revalidatePath("/medications");
  revalidatePath("/dashboard");
}

export async function updateMedicationCourseStatus(formData: FormData) {
  const { user, collection } = await getCollection();
  const id = String(formData.get("id"));
  const status = String(formData.get("status") ?? "COMPLETED");
  const before = await prisma.medicationCourse.findFirstOrThrow({ where: { id, collectionId: collection.id }, include: { medicationDefinition: true } });
  const course = await prisma.medicationCourse.update({
    where: { id },
    data: { status: status as never, completedAt: status === "ACTIVE" ? null : new Date() }
  });
  const event = await prisma.aquariumEvent.create({
    data: {
      collectionId: collection.id,
      aquariumId: before.aquariumId,
      relatedMedicationCourseId: id,
      eventType: "MEDICATION",
      title: `${status === "COMPLETED" ? "Completed" : "Cancelled"} ${before.title}`,
      summary: before.medicationDefinition.name,
      eventDate: new Date(),
      createdById: user.id
    }
  });
  await writeAuditLog({ entityType: "MedicationCourse", entityId: id, action: status, before, after: { course, event }, createdById: user.id });
  revalidatePath(`/aquariums/${before.aquariumId}`);
  revalidatePath("/medications");
  revalidatePath("/dashboard");
}

export async function createReading(formData: FormData) {
  const { user, collection } = await getCollection();
  const aquariumId = String(formData.get("aquariumId"));
  await prisma.aquarium.findFirstOrThrow({ where: { id: aquariumId, collectionId: collection.id } });
  const reading = await prisma.waterParameterReading.create({
    data: {
      aquariumId,
      parameter: String(formData.get("parameter") ?? "OTHER") as never,
      value: numberValue(formData, "value") ?? 0,
      unit: text(formData, "unit") ?? "",
      measuredAt: dateValue(formData, "measuredAt") ?? new Date(),
      notes: text(formData, "notes")
    }
  });
  await writeAuditLog({ entityType: "WaterParameterReading", entityId: reading.id, action: "CREATE", after: reading, createdById: user.id });
  revalidatePath(`/aquariums/${aquariumId}`);
  revalidatePath("/dashboard");
}

export async function createReadingsBatch(formData: FormData) {
  const { user, collection } = await getCollection();
  const aquariumId = String(formData.get("aquariumId"));
  await prisma.aquarium.findFirstOrThrow({ where: { id: aquariumId, collectionId: collection.id } });
  const measuredAt = dateValue(formData, "measuredAt") ?? new Date();
  const notes = text(formData, "notes");
  const readings = [
    ["temperature", "TEMPERATURE", "F"],
    ["ph", "PH", "pH"],
    ["ammonia", "AMMONIA", "ppm"],
    ["nitrite", "NITRITE", "ppm"],
    ["nitrate", "NITRATE", "ppm"],
    ["gh", "GH", "dGH"],
    ["kh", "KH", "dKH"],
    ["tds", "TDS", "ppm"],
    ["turbidity", "TURBIDITY", "NTU"],
    ["co2", "CO2", "ppm"],
    ["light", "LIGHT", "PAR"],
    ["waterLevel", "WATER_LEVEL", "in"]
  ] as const;
  const data = readings.flatMap(([field, parameter, defaultUnit]) => {
    const value = numberValue(formData, field);
    if (value === null || Number.isNaN(value)) return [];
    return [{
      aquariumId,
      parameter,
      value,
      unit: text(formData, `${field}Unit`) ?? defaultUnit,
      measuredAt,
      notes
    }];
  });

  if (data.length) {
    const event = await prisma.aquariumEvent.create({
      data: {
        collectionId: collection.id,
        aquariumId,
        eventType: "TEST_RESULT",
        title: `Logged ${data.length} parameter reading${data.length === 1 ? "" : "s"}`,
        summary: data.map((reading) => `${reading.parameter}: ${reading.value}${reading.unit}`).join(", "),
        notes,
        eventDate: measuredAt,
        createdById: user.id
      }
    });
    await prisma.waterParameterReading.createMany({
      data: data.map((reading) => ({ ...reading, aquariumEventId: event.id }))
    });
  }

  revalidatePath(`/aquariums/${aquariumId}`);
  revalidatePath("/dashboard");
}

export async function createLightingSchedule(formData: FormData) {
  const { user, collection } = await getCollection();
  const name = text(formData, "name") ?? "Unnamed schedule";
  const capabilityProfileId = text(formData, "capabilityProfileId");
  const profile = capabilityProfileId
    ? await prisma.lightCapabilityProfile.findFirstOrThrow({ where: { id: capabilityProfileId, collectionId: collection.id } })
    : await prisma.lightCapabilityProfile.findFirst({ where: { collectionId: collection.id }, orderBy: { name: "asc" } });
  if (!profile) throw new Error("Create a light capability profile before adding schedules.");
  const channels = parseLightChannels(profile.channels);
  const pointCount = Math.max(1, Math.min(numberValue(formData, "pointCount") ?? profile.pointCount, 8));
  const schedule = await prisma.lightingSchedule.create({
    data: {
      collectionId: collection.id,
      capabilityProfileId: profile.id,
      name,
      description: text(formData, "description"),
      points: {
        create: Array.from({ length: pointCount }, (_, index) => {
          const values = pointValuesFromForm(formData, index, channels);
          const legacy = legacyPointValues(values);
          return {
            timeOfDay: text(formData, `point-${index}-time`) ?? (index === 0 ? "10:00" : index === pointCount - 1 ? "20:00" : "14:00"),
            ...legacy,
            rampMinutes: Math.max(0, Math.round(numberValue(formData, `point-${index}-ramp`) ?? 0)),
            values,
            sortOrder: (index + 1) * 10
          };
        })
      }
    },
    include: { points: true, capabilityProfile: true }
  });
  await writeAuditLog({ entityType: "LightingSchedule", entityId: schedule.id, action: "CREATE", after: schedule, createdById: user.id });
  revalidatePath("/settings");
  revalidatePath("/lighting-schedules");
  revalidatePath("/aquariums");
}

export async function createLightCapabilityProfile(formData: FormData) {
  const { user, collection } = await getCollection();
  const channels = String(formData.get("channels") ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [key, label = key] = entry.split(":").map((part) => part.trim());
      return { key, label, color: "#7dd3fc", min: 0, max: 100, step: 5 };
    });
  const profile = await prisma.lightCapabilityProfile.create({
    data: {
      collectionId: collection.id,
      name: text(formData, "name") ?? "Custom light profile",
      description: text(formData, "description"),
      mode: String(formData.get("mode") ?? "CUSTOM") as never,
      pointCount: numberValue(formData, "pointCount") ?? 3,
      channels: channels.length ? channels : [{ key: "intensity", label: "Intensity", color: "#f7d889", min: 0, max: 100, step: 5 }]
    }
  });
  await writeAuditLog({ entityType: "LightCapabilityProfile", entityId: profile.id, action: "CREATE", after: profile, createdById: user.id });
  revalidatePath("/lighting-schedules");
  revalidatePath("/equipment");
}

export async function updateLightCapabilityProfile(formData: FormData) {
  const { user, collection } = await getCollection();
  const id = String(formData.get("id"));
  const before = await prisma.lightCapabilityProfile.findFirstOrThrow({ where: { id, collectionId: collection.id } });
  const profile = await prisma.lightCapabilityProfile.update({
    where: { id },
    data: {
      name: text(formData, "name") ?? before.name,
      description: text(formData, "description"),
      mode: String(formData.get("mode") ?? before.mode) as never,
      pointCount: numberValue(formData, "pointCount") ?? before.pointCount
    }
  });
  await writeAuditLog({ entityType: "LightCapabilityProfile", entityId: id, action: "UPDATE", before, after: profile, createdById: user.id });
  revalidatePath("/lighting-schedules");
  revalidatePath("/equipment");
}

export async function deleteLightCapabilityProfile(formData: FormData) {
  const { user, collection } = await getCollection();
  const id = String(formData.get("id"));
  const before = await prisma.lightCapabilityProfile.findFirstOrThrow({ where: { id, collectionId: collection.id } });
  const usage = (await prisma.equipmentProfile.count({ where: { lightCapabilityProfileId: id } }))
    + (await prisma.lightingSchedule.count({ where: { capabilityProfileId: id } }));
  if (usage > 0) throw new Error("This capability profile is used by equipment or schedules.");
  await prisma.lightCapabilityProfile.delete({ where: { id } });
  await writeAuditLog({ entityType: "LightCapabilityProfile", entityId: id, action: "DELETE", before, createdById: user.id });
  revalidatePath("/lighting-schedules");
  revalidatePath("/equipment");
}

export async function updateLightingSchedule(formData: FormData) {
  const { user, collection } = await getCollection();
  const id = String(formData.get("id"));
  const before = await prisma.lightingSchedule.findFirstOrThrow({
    where: { id, collectionId: collection.id },
    include: { points: true, capabilityProfile: true }
  });
  const capabilityProfileId = text(formData, "capabilityProfileId") ?? before.capabilityProfileId;
  const profile = capabilityProfileId
    ? await prisma.lightCapabilityProfile.findFirstOrThrow({ where: { id: capabilityProfileId, collectionId: collection.id } })
    : null;
  if (!profile) throw new Error("Lighting schedules need a capability profile.");
  const channels = parseLightChannels(profile.channels);
  const pointCount = Math.max(1, Math.min((numberValue(formData, "pointCount") ?? before.points.length) || profile.pointCount, 8));
  await prisma.lightingSchedulePoint.deleteMany({ where: { scheduleId: id } });
  const schedule = await prisma.lightingSchedule.update({
    where: { id },
    data: {
      capabilityProfileId: profile.id,
      name: text(formData, "name") ?? before.name,
      description: text(formData, "description"),
      points: {
        create: Array.from({ length: pointCount }, (_, index) => {
          const values = pointValuesFromForm(formData, index, channels);
          const legacy = legacyPointValues(values);
          return {
            timeOfDay: text(formData, `point-${index}-time`) ?? before.points[index]?.timeOfDay ?? "12:00",
            ...legacy,
            rampMinutes: Math.max(0, Math.round(numberValue(formData, `point-${index}-ramp`) ?? 0)),
            values,
            sortOrder: (index + 1) * 10
          };
        })
      }
    },
    include: { points: true, capabilityProfile: true }
  });
  await writeAuditLog({ entityType: "LightingSchedule", entityId: id, action: "UPDATE", before, after: schedule, createdById: user.id });
  revalidatePath("/lighting-schedules");
  revalidatePath("/aquariums");
}

export async function deleteLightingSchedule(formData: FormData) {
  const { user, collection } = await getCollection();
  const id = String(formData.get("id"));
  const before = await prisma.lightingSchedule.findFirstOrThrow({ where: { id, collectionId: collection.id }, include: { points: true } });
  const assignments = await prisma.aquariumLightingAssignment.count({ where: { scheduleId: id } });
  if (assignments > 0) throw new Error("Remove this schedule from lights before deleting it.");
  await prisma.lightingSchedule.delete({ where: { id } });
  await writeAuditLog({ entityType: "LightingSchedule", entityId: id, action: "DELETE", before, createdById: user.id });
  revalidatePath("/lighting-schedules");
  revalidatePath("/aquariums");
}

export async function duplicateLightingSchedule(formData: FormData) {
  const { user, collection } = await getCollection();
  const id = String(formData.get("id"));
  const before = await prisma.lightingSchedule.findFirstOrThrow({
    where: { id, collectionId: collection.id },
    include: { points: { orderBy: { sortOrder: "asc" } } }
  });
  const schedule = await prisma.lightingSchedule.create({
    data: {
      collectionId: collection.id,
      capabilityProfileId: before.capabilityProfileId,
      name: `${before.name} copy`,
      description: before.description,
      points: {
        create: before.points.map((point) => ({
          timeOfDay: point.timeOfDay,
          white: point.white,
          red: point.red,
          green: point.green,
          blue: point.blue,
          warmWhite: point.warmWhite,
          intensity: point.intensity,
          values: point.values ?? undefined,
          sortOrder: point.sortOrder
        }))
      }
    },
    include: { points: true }
  });
  await writeAuditLog({ entityType: "LightingSchedule", entityId: schedule.id, action: "DUPLICATE", after: schedule, createdById: user.id });
  revalidatePath("/lighting-schedules");
}

export async function assignLightingSchedule(formData: FormData) {
  const { user, collection } = await getCollection();
  const aquariumId = String(formData.get("aquariumId"));
  const equipmentItemId = text(formData, "equipmentItemId");
  const scheduleId = text(formData, "scheduleId");
  if (!equipmentItemId) throw new Error("Choose a light fixture before assigning a schedule.");
  await prisma.aquarium.findFirstOrThrow({ where: { id: aquariumId, collectionId: collection.id } });
  const equipment = await prisma.aquariumItem.findFirstOrThrow({
    where: { id: equipmentItemId, collectionId: collection.id, itemType: "EQUIPMENT" },
    include: { equipmentProfile: true }
  });
  if (equipment.equipmentProfile?.equipmentType !== "LIGHT") throw new Error("Only light equipment can receive a lighting schedule.");
  if (!equipment.equipmentProfile.lightCapabilityProfileId) throw new Error("This light needs a capability profile before it can use schedules.");
  const schedule = scheduleId
    ? await prisma.lightingSchedule.findFirstOrThrow({ where: { id: scheduleId, collectionId: collection.id } })
    : null;
  if (schedule && schedule.capabilityProfileId !== equipment.equipmentProfile.lightCapabilityProfileId) {
    throw new Error("This schedule is not compatible with the selected light.");
  }
  const assignment = await prisma.aquariumLightingAssignment.upsert({
    where: { aquariumId_equipmentItemId: { aquariumId, equipmentItemId } },
    create: {
      aquariumId,
      equipmentItemId,
      scheduleId,
      notes: text(formData, "lightingAssignmentNotes")
    },
    update: {
      scheduleId,
      notes: text(formData, "lightingAssignmentNotes")
    },
    include: { schedule: true, equipmentItem: true }
  });
  await prisma.aquariumEvent.create({
    data: {
      collectionId: collection.id,
      aquariumId,
      eventType: "EQUIPMENT_CHANGE",
      title: `Lighting updated for ${equipment.name}`,
      summary: schedule ? `Assigned ${schedule.name}` : "Lighting schedule cleared",
      relatedItemId: equipmentItemId,
      createdById: user.id
    }
  });
  await writeAuditLog({ entityType: "AquariumLightingAssignment", entityId: assignment.id, action: "UPSERT", after: assignment, createdById: user.id });
  revalidatePath(`/aquariums/${aquariumId}`);
  revalidatePath("/settings");
}

export async function clearLightingAssignment(formData: FormData) {
  const { user, collection } = await getCollection();
  const id = String(formData.get("id"));
  const assignment = await prisma.aquariumLightingAssignment.findFirstOrThrow({
    where: { id, aquarium: { collectionId: collection.id } },
    include: { aquarium: true }
  });
  await prisma.aquariumLightingAssignment.delete({ where: { id } });
  await writeAuditLog({ entityType: "AquariumLightingAssignment", entityId: id, action: "DELETE", before: assignment, createdById: user.id });
  revalidatePath(`/aquariums/${assignment.aquariumId}`);
}

export async function startWorkflow(formData: FormData) {
  const { collection } = await getCollection();
  const aquariumId = String(formData.get("aquariumId"));
  const workflowTemplateId = String(formData.get("workflowTemplateId"));
  await prisma.aquarium.findFirstOrThrow({ where: { id: aquariumId, collectionId: collection.id } });
  const template = await prisma.workflowTemplate.findUniqueOrThrow({ where: { id: workflowTemplateId }, include: { steps: true } });
  await prisma.workflowRun.create({
    data: {
      aquariumId,
      workflowTemplateId,
      stepRuns: {
        create: template.steps.map((step) => ({ workflowStepId: step.id }))
      }
    }
  });
  revalidatePath(`/aquariums/${aquariumId}`);
  revalidatePath("/workflows");
}

export async function completeWorkflowStep(formData: FormData) {
  const id = String(formData.get("id"));
  const step = await prisma.workflowStepRun.update({
    where: { id },
    data: { status: "COMPLETED", completedAt: new Date() },
    include: { workflowRun: true }
  });
  const remaining = await prisma.workflowStepRun.count({
    where: { workflowRunId: step.workflowRunId, status: { not: "COMPLETED" } }
  });
  if (remaining === 0) {
    await prisma.workflowRun.update({ where: { id: step.workflowRunId }, data: { status: "COMPLETED", completedAt: new Date() } });
  }
  revalidatePath(`/aquariums/${step.workflowRun.aquariumId}`);
}

export async function generateQrCode(formData: FormData) {
  const { user } = await getCollection();
  const entityType = String(formData.get("entityType"));
  const entityId = String(formData.get("entityId"));
  const label = text(formData, "label") ?? `${entityType} ${entityId}`;
  const lowerType = entityType.toLowerCase();
  const payload = lowerType === "aquarium"
    ? `fluxpoint://aquarium/${entityId}`
    : lowerType === "aquariumitem" || lowerType === "item"
      ? `fluxpoint://item/${entityId}`
      : `fluxpoint://${lowerType}/${entityId}`;
  const qr = await prisma.qrCode.create({ data: { entityType, entityId, label, payload } });
  await writeAuditLog({ entityType, entityId, action: "GENERATE_QR", after: qr, createdById: user.id });
  revalidatePath("/aquariums");
  revalidatePath("/equipment");
}
