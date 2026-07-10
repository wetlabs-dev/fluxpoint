"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { requireCollectionRole, structuralRoles } from "@/domains/auth/permissions";
import { writeAuditLog } from "@/domains/audit/audit-log";
import { setFormFlash } from "@/lib/forms/form-flash";
import { ensureInitialSetupPlan } from "@/domains/aquarium-plans/queries";
import { calculateAquariumPlanProgress } from "@/domains/aquarium-plans/progress";
import { implementAquariumPlanItem } from "@/domains/aquarium-plans/implementation";
import type { AquariumPlanItemStatus, AquariumPlanItemType, AquariumPlanPurchaseStatus } from "@prisma/client";

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function numberText(formData: FormData, key: string) {
  const value = text(formData, key);
  return value && Number.isFinite(Number(value)) ? value : null;
}

function dateValue(formData: FormData, key: string) {
  const value = text(formData, key);
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function checked(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

async function collectionContext() {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  await requireCollectionRole(collection.id, structuralRoles);
  return { user, collection };
}

export async function createRevisionPlan(formData: FormData) {
  const { user, collection } = await collectionContext();
  const aquariumId = String(formData.get("aquariumId") ?? "");
  const aquarium = await prisma.aquarium.findFirstOrThrow({ where: { id: aquariumId, collectionId: collection.id } });
  if (aquarium.status !== "ACTIVE") throw new Error("Revision plans can only be started for active aquariums.");
  const existing = await prisma.aquariumPlan.findFirst({
    where: { collectionId: collection.id, aquariumId, planType: "REVISION", status: { in: ["DRAFT", "ACTIVE", "PAUSED", "READY_TO_COMPLETE"] } },
    orderBy: { updatedAt: "desc" }
  });
  if (existing && formData.get("createSeparateDraft") !== "on") redirect(`/aquariums/${aquariumId}/plans/${existing.id}`);
  const plan = await prisma.aquariumPlan.create({
    data: {
      collectionId: collection.id,
      aquariumId,
      planType: "REVISION",
      status: formData.get("createSeparateDraft") === "on" ? "DRAFT" : "ACTIVE",
      title: text(formData, "title") || `${aquarium.name} revision`,
      description: text(formData, "description"),
      targetCompletionDate: dateValue(formData, "targetCompletionDate"),
      startedAt: new Date(),
      createdByUserId: user.id
    }
  });
  await prisma.aquariumEvent.create({ data: { collectionId: collection.id, aquariumId, eventType: "NOTE", title: `Revision plan started: ${plan.title}`, summary: "Operational state is unchanged until individual plan items are implemented.", createdById: user.id, metadata: { aquariumPlanId: plan.id } } });
  await writeAuditLog({ collectionId: collection.id, entityType: "AquariumPlan", entityId: plan.id, action: "AQUARIUM_REVISION_PLAN_CREATED", after: plan, createdById: user.id });
  revalidatePath(`/aquariums/${aquariumId}`);
  revalidatePath("/planning");
  redirect(`/aquariums/${aquariumId}/plans/${plan.id}`);
}

export async function addAquariumPlanItem(formData: FormData) {
  const { user, collection } = await collectionContext();
  const planId = String(formData.get("planId") ?? "");
  const plan = await prisma.aquariumPlan.findFirstOrThrow({ where: { id: planId, collectionId: collection.id }, include: { aquarium: true, items: true } });
  if (["COMPLETED", "CANCELLED", "ARCHIVED"].includes(plan.status)) throw new Error("Completed, cancelled, or archived plans cannot be changed.");
  const itemType = String(formData.get("itemType") ?? "TASK") as AquariumPlanItemType;
  const payload = buildPayload(formData, itemType);
  const estimatedUnitCost = numberText(formData, "estimatedUnitCost");
  const plannedQuantity = numberText(formData, "plannedQuantity");
  const quantity = plannedQuantity ? Number(plannedQuantity) : null;
  const item = await prisma.aquariumPlanItem.create({
    data: {
      collectionId: collection.id,
      aquariumPlanId: plan.id,
      itemType,
      category: text(formData, "category"),
      title: text(formData, "title") || defaultItemTitle(itemType),
      description: text(formData, "description"),
      sortOrder: plan.items.length ? Math.max(...plan.items.map((entry) => entry.sortOrder)) + 10 : 10,
      isRequired: checked(formData, "isRequired"),
      weight: Math.min(Math.max(Number(formData.get("weight") ?? 1), 1), 3),
      status: "PLANNED",
      plannedQuantity,
      plannedUnit: text(formData, "plannedUnit"),
      targetSpeciesDefinitionId: text(formData, "targetSpeciesDefinitionId"),
      targetSpeciesVariantId: text(formData, "targetSpeciesVariantId"),
      targetInventoryItemId: text(formData, "targetInventoryItemId"),
      targetEquipmentItemId: text(formData, "targetEquipmentItemId"),
      replacementInventoryItemId: text(formData, "replacementInventoryItemId"),
      sourceInventoryItemId: text(formData, "sourceInventoryItemId"),
      targetWorkflowTemplateId: text(formData, "targetWorkflowTemplateId"),
      estimatedUnitCost,
      estimatedTotalCost: estimatedUnitCost && quantity ? String(Number(estimatedUnitCost) * quantity) : estimatedUnitCost,
      vendor: text(formData, "vendor"),
      purchaseStatus: String(formData.get("purchaseStatus") ?? "NOT_NEEDED") as AquariumPlanPurchaseStatus,
      payload,
      logToTimeline: checked(formData, "logToTimeline")
    }
  });
  await writeAuditLog({ collectionId: collection.id, entityType: "AquariumPlanItem", entityId: item.id, action: "AQUARIUM_PLAN_ITEM_ADDED", after: item, createdById: user.id });
  revalidatePath(`/aquariums/${plan.aquariumId}/plans/${plan.id}`);
  revalidatePath(`/aquariums/${plan.aquariumId}`);
  revalidatePath("/planning");
  await setFormFlash(`Added plan item: ${item.title}.`);
}

export async function updateAquariumPlanItemStatus(formData: FormData) {
  const { user, collection } = await collectionContext();
  const itemId = String(formData.get("itemId") ?? "");
  const status = String(formData.get("status") ?? "PLANNED") as AquariumPlanItemStatus;
  if (!["PLANNED", "READY", "BLOCKED", "IN_PROGRESS", "CANCELLED"].includes(status)) throw new Error("Choose a valid unresolved status.");
  const item = await prisma.aquariumPlanItem.findFirstOrThrow({ where: { id: itemId, collectionId: collection.id }, include: { aquariumPlan: true } });
  if (item.status === "IMPLEMENTED") throw new Error("Implemented plan items cannot be reset; create a compensating plan item instead.");
  const updated = await prisma.aquariumPlanItem.update({ where: { id: item.id }, data: { status, implementationError: status === "BLOCKED" ? item.implementationError : null } });
  await writeAuditLog({ collectionId: collection.id, entityType: "AquariumPlanItem", entityId: item.id, action: "AQUARIUM_PLAN_ITEM_STATUS_CHANGED", before: { status: item.status }, after: { status: updated.status }, createdById: user.id });
  revalidatePath(`/aquariums/${item.aquariumPlan.aquariumId}/plans/${item.aquariumPlanId}`);
}

export async function skipAquariumPlanItem(formData: FormData) {
  const { user, collection } = await collectionContext();
  const itemId = String(formData.get("itemId") ?? "");
  const reason = text(formData, "skipReason") || "Skipped during plan review.";
  const item = await prisma.aquariumPlanItem.findFirstOrThrow({ where: { id: itemId, collectionId: collection.id }, include: { aquariumPlan: { include: { items: true } } } });
  if (item.status === "IMPLEMENTED") throw new Error("Implemented plan items cannot be skipped.");
  const updated = await prisma.aquariumPlanItem.update({ where: { id: item.id }, data: { status: "SKIPPED", skippedAt: new Date(), skipReason: reason } });
  await maybeUpdatePlanReady(item.aquariumPlanId);
  await writeAuditLog({ collectionId: collection.id, entityType: "AquariumPlanItem", entityId: item.id, action: "AQUARIUM_PLAN_ITEM_SKIPPED", before: item, after: updated, createdById: user.id });
  revalidatePath(`/aquariums/${item.aquariumPlan.aquariumId}/plans/${item.aquariumPlanId}`);
}

export async function implementPlanItemAction(formData: FormData) {
  const { user, collection } = await collectionContext();
  const itemId = String(formData.get("itemId") ?? "");
  const { planId, aquariumId } = await implementAquariumPlanItem({ itemId, collectionId: collection.id, userId: user.id });
  revalidatePath(`/aquariums/${aquariumId}/plans/${planId}`);
  revalidatePath(`/aquariums/${aquariumId}`);
  revalidatePath("/aquariums");
  revalidatePath("/dashboard");
  revalidatePath("/inventory");
  revalidatePath("/equipment");
  await setFormFlash("Plan item implemented.");
}

export async function activatePlannedAquarium(formData: FormData) {
  const { user, collection } = await collectionContext();
  const planId = String(formData.get("planId") ?? "");
  const plan = await prisma.aquariumPlan.findFirstOrThrow({ where: { id: planId, collectionId: collection.id, planType: "INITIAL_SETUP" }, include: { aquarium: true, items: true } });
  const progress = calculateAquariumPlanProgress(plan.items);
  if (!progress.readyToComplete) throw new Error("Resolve required setup items before activating this aquarium.");
  const before = plan.aquarium;
  const [aquarium, completed] = await prisma.$transaction([
    prisma.aquarium.update({ where: { id: plan.aquariumId }, data: { status: "ACTIVE", startedAt: plan.aquarium.startedAt ?? new Date() } }),
    prisma.aquariumPlan.update({ where: { id: plan.id }, data: { status: "COMPLETED", completedAt: new Date(), completedByUserId: user.id } }),
    prisma.aquariumEvent.create({ data: { collectionId: collection.id, aquariumId: plan.aquariumId, eventType: "NOTE", title: "Aquarium activated", summary: `Setup plan completed: ${plan.title}.`, createdById: user.id, metadata: { aquariumPlanId: plan.id } } })
  ]);
  await writeAuditLog({ collectionId: collection.id, entityType: "Aquarium", entityId: aquarium.id, action: "AQUARIUM_ACTIVATED_FROM_PLAN", before, after: aquarium, metadata: { planId: completed.id }, createdById: user.id });
  revalidatePath(`/aquariums/${aquarium.id}`);
  revalidatePath("/aquariums");
  revalidatePath("/dashboard");
  await setFormFlash(`Activated ${aquarium.name}.`);
}

export async function completeRevisionPlan(formData: FormData) {
  const { user, collection } = await collectionContext();
  const planId = String(formData.get("planId") ?? "");
  const plan = await prisma.aquariumPlan.findFirstOrThrow({ where: { id: planId, collectionId: collection.id, planType: "REVISION" }, include: { aquarium: true, items: true } });
  const progress = calculateAquariumPlanProgress(plan.items);
  if (!progress.readyToComplete) throw new Error("Resolve required revision items before completing this plan.");
  const completed = await prisma.aquariumPlan.update({ where: { id: plan.id }, data: { status: "COMPLETED", completedAt: new Date(), completedByUserId: user.id, notes: text(formData, "notes") ?? plan.notes } });
  await prisma.aquariumEvent.create({ data: { collectionId: collection.id, aquariumId: plan.aquariumId, eventType: "NOTE", title: `Revision completed: ${plan.title}`, summary: summarizeCompletedRevision(plan.items), createdById: user.id, metadata: { aquariumPlanId: plan.id } } });
  await writeAuditLog({ collectionId: collection.id, entityType: "AquariumPlan", entityId: plan.id, action: "AQUARIUM_REVISION_PLAN_COMPLETED", before: plan, after: completed, createdById: user.id });
  revalidatePath(`/aquariums/${plan.aquariumId}`);
  revalidatePath("/planning");
  await setFormFlash(`Completed revision: ${plan.title}.`);
}

export async function cancelAquariumPlan(formData: FormData) {
  const { user, collection } = await collectionContext();
  const planId = String(formData.get("planId") ?? "");
  const plan = await prisma.aquariumPlan.findFirstOrThrow({ where: { id: planId, collectionId: collection.id }, include: { items: true } });
  await prisma.$transaction([
    prisma.aquariumPlan.update({ where: { id: plan.id }, data: { status: "CANCELLED", cancelledAt: new Date(), notes: text(formData, "notes") ?? plan.notes } }),
    prisma.aquariumPlanItem.updateMany({ where: { aquariumPlanId: plan.id, status: { notIn: ["IMPLEMENTED", "SKIPPED", "CANCELLED"] } }, data: { status: "CANCELLED" } })
  ]);
  await writeAuditLog({ collectionId: collection.id, entityType: "AquariumPlan", entityId: plan.id, action: "AQUARIUM_PLAN_CANCELLED", before: plan, metadata: { note: "Implemented items were not rolled back." }, createdById: user.id });
  revalidatePath(`/aquariums/${plan.aquariumId}`);
  revalidatePath("/planning");
  await setFormFlash("Plan cancelled. Implemented changes were not undone.");
}

export async function openInitialSetupPlan(formData: FormData) {
  const { user, collection } = await collectionContext();
  const aquariumId = String(formData.get("aquariumId") ?? "");
  const plan = await ensureInitialSetupPlan(aquariumId, collection.id, user.id);
  if (!plan) throw new Error("This aquarium is not in planning status.");
  redirect(`/aquariums/${aquariumId}/plans/${plan.id}`);
}

function buildPayload(formData: FormData, itemType: AquariumPlanItemType) {
  const payload: Record<string, any> = {};
  for (const key of ["role", "notes", "name", "itemType", "sourceId", "acquiredAt", "waterSourceId", "waterRecipeId", "targetTemperature", "targetPh", "targetGh", "targetKh", "targetSalinityMinPpt", "targetSalinityMaxPpt"]) {
    const value = text(formData, key);
    if (value !== null) payload[key] = value;
  }
  if (itemType === "WORKFLOW") payload.completionMode = String(formData.get("workflowCompletionMode") ?? "START");
  return Object.keys(payload).length ? payload : undefined;
}

function defaultItemTitle(itemType: AquariumPlanItemType) {
  return itemType.toLowerCase().replaceAll("_", " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

async function maybeUpdatePlanReady(planId: string) {
  const plan = await prisma.aquariumPlan.findUnique({ where: { id: planId }, include: { items: true } });
  if (!plan || ["COMPLETED", "CANCELLED", "ARCHIVED"].includes(plan.status)) return;
  const progress = calculateAquariumPlanProgress(plan.items);
  if (progress.readyToComplete) await prisma.aquariumPlan.update({ where: { id: plan.id }, data: { status: "READY_TO_COMPLETE" } });
}

function summarizeCompletedRevision(items: { itemType: string; status: string; title: string }[]) {
  const implemented = items.filter((item) => item.status === "IMPLEMENTED");
  if (!implemented.length) return "Revision completed with no implemented operational changes.";
  return implemented.slice(0, 5).map((item) => item.title).join("; ") + (implemented.length > 5 ? `; and ${implemented.length - 5} more.` : ".");
}
