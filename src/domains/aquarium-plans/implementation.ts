import type { AquariumEquipmentRole, AquariumPlanItem, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/domains/audit/audit-log";
import { isAttachableAquariumItem } from "@/domains/aquariums/equipment-attachments";
import { speciesMatchesAquariumTarget } from "@/domains/species/habitat";
import { syncAquariumMetricThresholds } from "@/domains/metrics/aquarium-thresholds";

type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

function payloadObject(payload: unknown): Record<string, any> {
  return payload && typeof payload === "object" && !Array.isArray(payload) ? payload as Record<string, any> : {};
}

function numberFrom(value: unknown, fallback = 1) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function dateFrom(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function implementAquariumPlanItem({ itemId, collectionId, userId }: { itemId: string; collectionId: string; userId: string }) {
  let implementedPlanId = "";
  let aquariumId = "";
  const result = await prisma.$transaction(async (tx) => {
    const item = await tx.aquariumPlanItem.findFirst({
      where: { id: itemId, collectionId },
      include: {
        aquariumPlan: { include: { aquarium: { include: { profile: true } } } },
        dependencies: { include: { dependsOnPlanItem: true } },
        targetSpeciesDefinition: true,
        targetSpeciesVariant: true,
        targetEquipmentItem: { include: { equipmentProfile: true, aquariumAttachments: true } },
        targetInventoryItem: true,
        replacementInventoryItem: true,
        sourceInventoryItem: true
      }
    });
    if (!item) throw new Error("Plan item not found.");
    implementedPlanId = item.aquariumPlanId;
    aquariumId = item.aquariumPlan.aquariumId;
    if (item.status === "IMPLEMENTED") return item.implementationResult ?? { alreadyImplemented: true };
    if (["CANCELLED", "SKIPPED"].includes(item.status)) throw new Error("Cancelled or skipped plan items cannot be implemented.");
    const blockers = item.dependencies.filter((dependency) => !["IMPLEMENTED", "SKIPPED"].includes(dependency.dependsOnPlanItem.status));
    if (blockers.length) {
      await tx.aquariumPlanItem.update({ where: { id: item.id }, data: { status: "BLOCKED", implementationError: `Waiting for: ${blockers.map((entry) => entry.dependsOnPlanItem.title).join(", ")}` } });
      throw new Error(`Waiting for: ${blockers.map((entry) => entry.dependsOnPlanItem.title).join(", ")}`);
    }

    let implementationResult: Record<string, any>;
    switch (item.itemType) {
      case "TASK":
      case "MAINTENANCE":
      case "PHOTO":
      case "OTHER":
        implementationResult = await implementChecklistItem(tx, item, userId);
        break;
      case "LIVESTOCK_ADD":
      case "PLANT_ADD":
      case "ORGANISM_ADD":
        implementationResult = await implementInhabitantAdd(tx, item, userId);
        break;
      case "EQUIPMENT_ATTACH":
      case "INVENTORY_ASSIGN":
        implementationResult = await implementEquipmentAttach(tx, item, userId);
        break;
      case "EQUIPMENT_REMOVE":
        implementationResult = await implementEquipmentRemove(tx, item, userId);
        break;
      case "EQUIPMENT_REPLACE":
        implementationResult = await implementEquipmentReplace(tx, item, userId);
        break;
      case "WATER_TARGET_CHANGE":
      case "AQUARIUM_PROFILE_CHANGE":
      case "WATER_SOURCE_CHANGE":
      case "WATER_RECIPE_CHANGE":
        implementationResult = await implementAquariumProfileChange(tx, item, userId);
        break;
      default:
        throw new Error(`${item.itemType.toLowerCase().replaceAll("_", " ")} is staged but does not have a safe automatic implementation path yet.`);
    }

    const updated = await tx.aquariumPlanItem.update({
      where: { id: item.id },
      data: {
        status: "IMPLEMENTED",
        implementationResult,
        implementationError: null,
        implementedAt: new Date(),
        implementedByUserId: userId,
        actualCost: item.actualCost ?? item.estimatedTotalCost
      }
    });
    await tx.aquariumPlanItem.updateMany({
      where: {
        aquariumPlanId: item.aquariumPlanId,
        status: "BLOCKED",
        dependencies: { every: { dependsOnPlanItem: { status: { in: ["IMPLEMENTED", "SKIPPED"] } } } }
      },
      data: { status: "READY", implementationError: null }
    });
    await maybeMarkPlanReady(tx, item.aquariumPlanId);
    await writeAuditLog({ collectionId, entityType: "AquariumPlanItem", entityId: item.id, action: "AQUARIUM_PLAN_ITEM_IMPLEMENTED", after: { item: updated, implementationResult }, createdById: userId });
    return implementationResult;
  });

  if (typeof result === "object" && result && !Array.isArray(result) && "thresholdsNeedSync" in result && aquariumId) await syncAquariumMetricThresholds(aquariumId);
  return { planId: implementedPlanId, aquariumId, result };
}

async function implementChecklistItem(tx: Tx, item: AquariumPlanItem & { aquariumPlan: any }, userId: string) {
  if (item.logToTimeline) {
    const event = await tx.aquariumEvent.create({
      data: {
        collectionId: item.collectionId,
        aquariumId: item.aquariumPlan.aquariumId,
        eventType: item.itemType === "PHOTO" ? "PHOTO" : item.itemType === "MAINTENANCE" ? "MAINTENANCE" : "NOTE",
        title: item.title,
        summary: item.description,
        createdById: userId,
        metadata: { aquariumPlanId: item.aquariumPlanId, aquariumPlanItemId: item.id }
      }
    });
    return { kind: "timeline", eventId: event.id };
  }
  return { kind: "checklist" };
}

async function implementInhabitantAdd(tx: Tx, item: AquariumPlanItem & { aquariumPlan: any; targetSpeciesDefinition: any; targetSpeciesVariant: any }, userId: string) {
  const payload = payloadObject(item.payload);
  const aquarium = item.aquariumPlan.aquarium;
  const itemType = item.itemType === "PLANT_ADD" ? "PLANT" : (payload.itemType || item.targetSpeciesDefinition?.category || "FISH");
  const quantity = numberFrom(item.plannedQuantity, 1);
  if (quantity <= 0) throw new Error("Planned quantity must be greater than zero.");
  if (item.targetSpeciesDefinition && !speciesMatchesAquariumTarget(aquarium.targetSalinityMinPpt, aquarium.targetSalinityMaxPpt, item.targetSpeciesDefinition.salinityMin, item.targetSpeciesDefinition.salinityMax)) {
    throw new Error(`${item.targetSpeciesDefinition.commonName} does not match this aquarium's target salinity range.`);
  }
  const name = payload.name || item.targetSpeciesVariant?.displayName || item.targetSpeciesVariant?.name || item.targetSpeciesDefinition?.commonName || item.title;
  const sourceId = payload.sourceId || null;
  const purchasePrice = item.actualCost ?? item.estimatedUnitCost ?? null;
  const acquiredAt = dateFrom(payload.acquiredAt) ?? new Date();
  const unit = item.plannedUnit || payload.unit || (itemType === "PLANT" ? "plants" : itemType === "INVERT" ? "inverts" : "fish");
  const matching = item.targetSpeciesDefinitionId && !sourceId && !purchasePrice
    ? await tx.aquariumItem.findFirst({
        where: {
          collectionId: item.collectionId,
          aquariumId: aquarium.id,
          itemType,
          speciesDefinitionId: item.targetSpeciesDefinitionId,
          speciesVariantId: item.targetSpeciesVariantId,
          status: { in: ["ACTIVE", "IN_AQUARIUM"] }
        }
      })
    : null;
  const inventoryItem = matching
    ? await tx.aquariumItem.update({ where: { id: matching.id }, data: { quantity: { increment: quantity }, status: "IN_AQUARIUM" } })
    : await tx.aquariumItem.create({
        data: {
          collectionId: item.collectionId,
          aquariumId: aquarium.id,
          itemType,
          speciesDefinitionId: item.targetSpeciesDefinitionId,
          speciesVariantId: item.targetSpeciesVariantId,
          name,
          quantity,
          unit,
          status: "IN_AQUARIUM",
          sourceId,
          purchasePrice,
          acquiredAt,
          notes: payload.notes || item.description
        }
      });
  const eventType = itemType === "PLANT" ? "PLANT_ADDITION" : "LIVESTOCK_ADDITION";
  const event = await tx.aquariumEvent.create({
    data: {
      collectionId: item.collectionId,
      aquariumId: aquarium.id,
      relatedItemId: inventoryItem.id,
      relatedSpeciesId: item.targetSpeciesDefinitionId,
      eventType,
      title: `Plan applied: ${item.title}`,
      summary: `Added ${quantity} ${unit}.`,
      eventDate: acquiredAt,
      createdById: userId,
      metadata: { aquariumPlanId: item.aquariumPlanId, aquariumPlanItemId: item.id, quantity, itemType }
    }
  });
  return { kind: "inhabitant_add", itemId: inventoryItem.id, eventId: event.id, quantity };
}

async function implementEquipmentAttach(tx: Tx, item: AquariumPlanItem & { aquariumPlan: any; targetEquipmentItem: any }, userId: string) {
  const payload = payloadObject(item.payload);
  const equipment = item.targetEquipmentItem;
  if (!equipment) throw new Error("Choose equipment or substrate to attach.");
  if (!isAttachableAquariumItem(equipment.itemType)) throw new Error("Only equipment and substrate inventory can be attached.");
  const role = String(payload.role || "OTHER") as AquariumEquipmentRole;
  const aquariumId = item.aquariumPlan.aquariumId;
  const existing = await tx.aquariumEquipmentAttachment.findFirst({ where: { aquariumId, itemId: equipment.id, role } });
  if (existing) return { kind: "equipment_attach", attachmentId: existing.id, alreadyAttached: true };
  const attachment = await tx.aquariumEquipmentAttachment.create({ data: { collectionId: item.collectionId, aquariumId, itemId: equipment.id, role, notes: payload.notes || item.description } });
  const event = await tx.aquariumEvent.create({
    data: { collectionId: item.collectionId, aquariumId, relatedItemId: equipment.id, eventType: "EQUIPMENT_CHANGE", title: `Plan applied: ${item.title}`, summary: `Attached ${equipment.name}.`, createdById: userId, metadata: { aquariumPlanId: item.aquariumPlanId, aquariumPlanItemId: item.id } }
  });
  return { kind: "equipment_attach", attachmentId: attachment.id, eventId: event.id };
}

async function implementEquipmentRemove(tx: Tx, item: AquariumPlanItem & { aquariumPlan: any; targetEquipmentItem: any }, userId: string) {
  const payload = payloadObject(item.payload);
  const aquariumId = item.aquariumPlan.aquariumId;
  const where: any = { aquariumId, collectionId: item.collectionId, itemId: item.targetEquipmentItemId || undefined };
  if (payload.role) where.role = String(payload.role) as AquariumEquipmentRole;
  const attachment = await tx.aquariumEquipmentAttachment.findFirst({
    where,
    include: { item: true }
  });
  if (!attachment) throw new Error("That equipment attachment is no longer present on this aquarium.");
  await tx.aquariumEquipmentAttachment.delete({ where: { id: attachment.id } });
  if (attachment.role === "LIGHT") await tx.aquariumLightingAssignment.deleteMany({ where: { aquariumId, equipmentItemId: attachment.itemId } });
  const event = await tx.aquariumEvent.create({
    data: { collectionId: item.collectionId, aquariumId, relatedItemId: attachment.itemId, eventType: "EQUIPMENT_CHANGE", title: `Plan applied: ${item.title}`, summary: `Detached ${attachment.item.name}; inventory record preserved.`, createdById: userId, metadata: { aquariumPlanId: item.aquariumPlanId, aquariumPlanItemId: item.id } }
  });
  return { kind: "equipment_remove", attachmentId: attachment.id, itemId: attachment.itemId, eventId: event.id };
}

async function implementEquipmentReplace(tx: Tx, item: AquariumPlanItem & { aquariumPlan: any }, userId: string) {
  const removed = await implementEquipmentRemove(tx, item as any, userId);
  const attachItem = { ...item, targetEquipmentItemId: item.replacementInventoryItemId, targetEquipmentItem: (item as any).replacementInventoryItem } as any;
  const attached = await implementEquipmentAttach(tx, attachItem, userId);
  return { kind: "equipment_replace", removed, attached };
}

async function implementAquariumProfileChange(tx: Tx, item: AquariumPlanItem & { aquariumPlan: any }, userId: string) {
  const payload = payloadObject(item.payload);
  const aquariumId = item.aquariumPlan.aquariumId;
  const aquariumData: Record<string, any> = {};
  const profileData: Record<string, any> = {};
  for (const key of ["targetSalinityMinPpt", "targetSalinityMaxPpt"]) {
    if (payload[key] !== undefined && payload[key] !== "") aquariumData[key] = Number(payload[key]);
  }
  if (payload.waterSourceId !== undefined) aquariumData.waterSourceId = payload.waterSourceId || null;
  if (payload.waterRecipeId !== undefined) aquariumData.waterRecipeId = payload.waterRecipeId || null;
  for (const [sourceKey, profileKey] of [["targetTemperature", "targetTemperature"], ["targetPh", "targetPh"], ["targetGh", "targetGh"], ["targetKh", "targetKh"]]) {
    if (payload[sourceKey] !== undefined && payload[sourceKey] !== "") profileData[profileKey] = Number(payload[sourceKey]);
  }
  if (payload.notes !== undefined) profileData.notes = payload.notes || null;
  const before = await tx.aquarium.findUnique({ where: { id: aquariumId }, include: { profile: true } });
  if (Object.keys(aquariumData).length) await tx.aquarium.update({ where: { id: aquariumId }, data: aquariumData });
  if (Object.keys(profileData).length) {
    await tx.aquariumProfile.upsert({ where: { aquariumId }, create: { aquariumId, ...profileData }, update: profileData });
  }
  const after = await tx.aquarium.findUnique({ where: { id: aquariumId }, include: { profile: true } });
  const event = await tx.aquariumEvent.create({
    data: { collectionId: item.collectionId, aquariumId, eventType: "PARAMETER_TARGETS_UPDATED", title: `Plan applied: ${item.title}`, summary: "Aquarium target/profile settings were updated from the plan.", createdById: userId, metadata: { aquariumPlanId: item.aquariumPlanId, aquariumPlanItemId: item.id, before, after } }
  });
  return { kind: "aquarium_profile_change", eventId: event.id, thresholdsNeedSync: true };
}

async function maybeMarkPlanReady(tx: Tx, planId: string) {
  const plan = await tx.aquariumPlan.findUnique({ where: { id: planId }, include: { items: true } });
  if (!plan || plan.status === "READY_TO_COMPLETE" || plan.status === "COMPLETED") return;
  const unresolvedRequired = plan.items.some((entry) => entry.isRequired && !["IMPLEMENTED", "SKIPPED", "CANCELLED"].includes(entry.status));
  if (!unresolvedRequired && plan.items.some((entry) => entry.isRequired && entry.status !== "CANCELLED")) {
    await tx.aquariumPlan.update({ where: { id: plan.id }, data: { status: "READY_TO_COMPLETE" } });
  }
}
