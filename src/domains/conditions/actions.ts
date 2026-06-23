"use server";

import type { HealthConditionEntityType, HealthConditionSeverity, HealthConditionStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUserCollection } from "@/lib/auth/session";
import { careRoles, collectionOwnerRoles, requireCollectionRole, structuralRoles } from "@/domains/auth/permissions";
import { writeAuditLog } from "@/domains/audit/audit-log";
import { activeConditionStatuses, conditionCategories, conditionEntityTypes, conditionSeverities, conditionStatuses, severityPriority } from "@/domains/conditions/condition-catalog";
import { setFormFlash } from "@/lib/forms/form-flash";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() || null : null;
}

function dateValue(formData: FormData, key: string, fallback = new Date()) {
  const value = text(formData, key);
  const date = value ? new Date(value) : fallback;
  if (Number.isNaN(date.getTime())) throw new Error(`${key} is not a valid date.`);
  return date;
}

function numberValue(formData: FormData, key: string) {
  const value = text(formData, key);
  if (!value) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error(`${key} must be zero or greater.`);
  return number;
}

async function context(roles = structuralRoles) {
  const user = await import("@/lib/auth/session").then(({ requireUser }) => requireUser());
  const collection = await getUserCollection(user.id);
  const { role } = await requireCollectionRole(collection.id, roles);
  return { user, collection, role };
}

async function validateEntity(collectionId: string, entityType: HealthConditionEntityType, entityId: string | null, aquariumId: string | null) {
  if (aquariumId) await prisma.aquarium.findFirstOrThrow({ where: { id: aquariumId, collectionId } });
  if (["INVENTORY_ITEM", "EQUIPMENT", "PLANT", "FISH", "INVERT", "CORAL"].includes(entityType)) {
    if (!entityId) throw new Error("Choose the affected inventory or equipment record.");
    const item = await prisma.aquariumItem.findFirstOrThrow({ where: { id: entityId, collectionId }, select: { aquariumId: true } });
    if (aquariumId && item.aquariumId && item.aquariumId !== aquariumId) throw new Error("The selected record is not in that aquarium.");
  }
  if (entityType === "SPECIES") {
    if (!entityId) throw new Error("Choose the affected species.");
    await prisma.speciesDefinition.findFirstOrThrow({ where: { id: entityId, OR: [{ collectionId }, { collectionId: null }] } });
  }
  if (entityType === "AQUARIUM" && !aquariumId) throw new Error("Choose an aquarium.");
}

async function createFollowUp(input: { conditionId: string; collectionId: string; aquariumId: string | null; title: string; severity: HealthConditionSeverity; dueAt: Date }) {
  const schedule = await prisma.careSchedule.create({
    data: {
      collectionId: input.collectionId,
      aquariumId: input.aquariumId,
      name: `Condition follow-up: ${input.title}`,
      description: "One-time observation requested by a condition record.",
      scheduleType: "CONDITION_CHECK",
      cadenceType: "CUSTOM",
      startDate: input.dueAt,
      nextDueAt: input.dueAt,
      enabled: false
    }
  });
  const task = await prisma.careTask.create({
    data: { careScheduleId: schedule.id, aquariumId: input.aquariumId, relatedConditionId: input.conditionId, title: `Check ${input.title}`, description: "Record an observation and update the condition if needed.", dueAt: input.dueAt, priority: severityPriority(input.severity) }
  });
  await prisma.healthConditionLink.create({ data: { collectionId: input.collectionId, conditionId: input.conditionId, linkedEntityType: "CARE_TASK", linkedEntityId: task.id, relationship: "FOLLOW_UP" } });
  return task;
}

function revalidateCondition(id: string, aquariumId?: string | null) {
  revalidatePath("/conditions");
  revalidatePath(`/conditions/${id}`);
  revalidatePath("/dashboard");
  revalidatePath("/schedules");
  revalidatePath("/inventory");
  revalidatePath("/equipment");
  if (aquariumId) revalidatePath(`/aquariums/${aquariumId}`);
}

export async function createCondition(formData: FormData) {
  const { user, collection } = await context();
  const aquariumId = text(formData, "aquariumId");
  const entityId = text(formData, "entityId");
  const entityTypeValue = text(formData, "entityType") ?? "AQUARIUM";
  const categoryValue = text(formData, "category") ?? "UNKNOWN";
  const severityValue = text(formData, "severity") ?? "MODERATE";
  const entityType = conditionEntityTypes.includes(entityTypeValue as never) ? entityTypeValue as HealthConditionEntityType : "OTHER";
  const category = conditionCategories.includes(categoryValue as never) ? categoryValue as never : "UNKNOWN";
  const severity = conditionSeverities.includes(severityValue as never) ? severityValue as HealthConditionSeverity : "MODERATE";
  const title = text(formData, "title");
  const conditionType = text(formData, "conditionType");
  if (!title || !conditionType) throw new Error("Title and condition type are required.");
  await validateEntity(collection.id, entityType, entityId, aquariumId);
  const firstObservedAt = dateValue(formData, "firstObservedAt");
  const condition = await prisma.$transaction(async (tx) => {
    const created = await tx.healthCondition.create({
      data: {
        collectionId: collection.id, aquariumId, entityType, entityId, title: title.slice(0, 160), conditionType: conditionType.slice(0, 160), category,
        severity, firstObservedAt, lastObservedAt: firstObservedAt, affectedCount: numberValue(formData, "affectedCount"), affectedCountLabel: text(formData, "affectedCountLabel"),
        summary: text(formData, "summary"), suspectedCause: text(formData, "suspectedCause"), actionPlan: text(formData, "actionPlan"), createdById: user.id, updatedById: user.id
      }
    });
    if (aquariumId) await tx.healthConditionLink.create({ data: { collectionId: collection.id, conditionId: created.id, linkedEntityType: "AQUARIUM", linkedEntityId: aquariumId, relationship: "OBSERVED_IN" } });
    if (entityId) await tx.healthConditionLink.create({ data: { collectionId: collection.id, conditionId: created.id, linkedEntityType: entityType === "SPECIES" ? "SPECIES" : entityType === "EQUIPMENT" ? "EQUIPMENT" : "INVENTORY_ITEM", linkedEntityId: entityId, relationship: "AFFECTS" } });
    if (aquariumId) {
      const event = await tx.aquariumEvent.create({ data: { collectionId: collection.id, aquariumId, relatedConditionId: created.id, relatedItemId: entityType !== "SPECIES" ? entityId : null, relatedSpeciesId: entityType === "SPECIES" ? entityId : null, eventType: entityType === "EQUIPMENT" ? "EQUIPMENT_ISSUE_LOGGED" : "CONDITION_CREATED", title: `Condition logged: ${created.title}`, summary: created.summary, eventDate: firstObservedAt, createdById: user.id } });
      await tx.healthConditionLink.create({ data: { collectionId: collection.id, conditionId: created.id, linkedEntityType: "TIMELINE_EVENT", linkedEntityId: event.id, relationship: "RELATED_TO" } });
    }
    return created;
  });
  const followUp = text(formData, "followUpDueAt");
  if (followUp) await createFollowUp({ conditionId: condition.id, collectionId: collection.id, aquariumId, title: condition.title, severity, dueAt: dateValue(formData, "followUpDueAt") });
  await writeAuditLog({ collectionId: collection.id, entityType: "HealthCondition", entityId: condition.id, action: "CONDITION_CREATED", after: condition, createdById: user.id });
  revalidateCondition(condition.id, aquariumId);
  await setFormFlash(`Created condition: ${condition.title}.`);
  redirect(`/conditions/${condition.id}`);
}

export async function addConditionObservation(formData: FormData) {
  const { user, collection, role } = await context(careRoles);
  const conditionId = text(formData, "conditionId");
  const notes = text(formData, "notes");
  if (!conditionId || !notes) throw new Error("Observation notes are required.");
  const condition = await prisma.healthCondition.findFirstOrThrow({ where: { id: conditionId, collectionId: collection.id } });
  if (condition.status === "ARCHIVED") throw new Error("Archived conditions cannot be changed.");
  const statusValue = text(formData, "status");
  const severityValue = text(formData, "severity");
  const status = statusValue && conditionStatuses.includes(statusValue as never) ? statusValue as HealthConditionStatus : null;
  const severity = severityValue && conditionSeverities.includes(severityValue as never) ? severityValue as HealthConditionSeverity : null;
  if (role === "FISHKEEPER" && (status || severity)) throw new Error("Aquarist access is required to change condition status or severity.");
  const observedAt = dateValue(formData, "observedAt");
  const affectedCount = numberValue(formData, "affectedCount");
  const nextStatus = status ?? condition.status;
  await prisma.$transaction(async (tx) => {
    await tx.healthConditionObservation.create({ data: { collectionId: collection.id, conditionId, observedAt, status, severity, affectedCount, notes, createdById: user.id } });
    await tx.healthCondition.update({ where: { id: conditionId }, data: { lastObservedAt: observedAt, ...(status ? { status, resolvedAt: status === "RESOLVED" ? observedAt : null } : {}), ...(severity ? { severity } : {}), ...(affectedCount !== null ? { affectedCount } : {}), updatedById: user.id } });
    if (condition.aquariumId) {
      const event = await tx.aquariumEvent.create({ data: { collectionId: collection.id, aquariumId: condition.aquariumId, relatedConditionId: condition.id, eventType: nextStatus === "RESOLVED" ? "CONDITION_RESOLVED" : status && status !== condition.status ? "CONDITION_STATUS_CHANGED" : "CONDITION_OBSERVATION", title: nextStatus === "RESOLVED" ? `Resolved: ${condition.title}` : `Condition observation: ${condition.title}`, summary: notes.slice(0, 500), eventDate: observedAt, createdById: user.id } });
      await tx.healthConditionLink.create({ data: { collectionId: collection.id, conditionId, linkedEntityType: "TIMELINE_EVENT", linkedEntityId: event.id, relationship: "RELATED_TO" } });
    }
  });
  const followUp = text(formData, "followUpDueAt");
  if (followUp && activeConditionStatuses.includes(nextStatus)) await createFollowUp({ conditionId, collectionId: collection.id, aquariumId: condition.aquariumId, title: condition.title, severity: severity ?? condition.severity, dueAt: dateValue(formData, "followUpDueAt") });
  await writeAuditLog({ collectionId: collection.id, entityType: "HealthCondition", entityId: conditionId, action: nextStatus === "RESOLVED" ? "CONDITION_RESOLVED" : status && status !== condition.status ? "CONDITION_STATUS_CHANGED" : "CONDITION_OBSERVATION_ADDED", before: { status: condition.status, severity: condition.severity }, after: { status: nextStatus, severity: severity ?? condition.severity, affectedCount, notes }, createdById: user.id });
  revalidateCondition(conditionId, condition.aquariumId);
  await setFormFlash("Condition observation saved.");
}

export async function updateConditionPlan(formData: FormData) {
  const { user, collection } = await context();
  const conditionId = text(formData, "conditionId");
  if (!conditionId) throw new Error("Condition is required.");
  const before = await prisma.healthCondition.findFirstOrThrow({ where: { id: conditionId, collectionId: collection.id } });
  const updated = await prisma.healthCondition.update({ where: { id: conditionId }, data: { summary: text(formData, "summary"), suspectedCause: text(formData, "suspectedCause"), actionPlan: text(formData, "actionPlan"), resolutionNotes: text(formData, "resolutionNotes"), updatedById: user.id } });
  await writeAuditLog({ collectionId: collection.id, entityType: "HealthCondition", entityId: conditionId, action: "CONDITION_EDITED", before, after: updated, createdById: user.id });
  revalidateCondition(conditionId, updated.aquariumId);
  await setFormFlash("Condition plan saved.");
}

export async function archiveCondition(formData: FormData) {
  const { user, collection } = await context(collectionOwnerRoles);
  const conditionId = text(formData, "conditionId");
  if (!conditionId) throw new Error("Condition is required.");
  const before = await prisma.healthCondition.findFirstOrThrow({ where: { id: conditionId, collectionId: collection.id } });
  const updated = await prisma.healthCondition.update({ where: { id: conditionId }, data: { status: "ARCHIVED", updatedById: user.id } });
  await writeAuditLog({ collectionId: collection.id, entityType: "HealthCondition", entityId: conditionId, action: "CONDITION_ARCHIVED", before, after: updated, createdById: user.id });
  revalidateCondition(conditionId, updated.aquariumId);
  await setFormFlash("Condition archived.");
  redirect("/conditions");
}

export async function linkMedicationCourse(formData: FormData) {
  const { user, collection } = await context();
  const conditionId = text(formData, "conditionId");
  const medicationCourseId = text(formData, "medicationCourseId");
  if (!conditionId || !medicationCourseId) throw new Error("Choose a condition and medication course.");
  const condition = await prisma.healthCondition.findFirstOrThrow({ where: { id: conditionId, collectionId: collection.id } });
  const course = await prisma.medicationCourse.findFirstOrThrow({ where: { id: medicationCourseId, collectionId: collection.id } });
  if (condition.aquariumId && course.aquariumId !== condition.aquariumId) throw new Error("Medication and condition must belong to the same aquarium.");
  await prisma.$transaction([
    prisma.medicationCourse.update({ where: { id: course.id }, data: { relatedConditionId: condition.id } }),
    prisma.healthCondition.update({ where: { id: condition.id }, data: { status: condition.status === "ACTIVE" ? "TREATING" : condition.status, updatedById: user.id } }),
    prisma.healthConditionLink.upsert({ where: { conditionId_linkedEntityType_linkedEntityId_relationship: { conditionId: condition.id, linkedEntityType: "MEDICATION_COURSE", linkedEntityId: course.id, relationship: "TREATED_BY" } }, create: { collectionId: collection.id, conditionId: condition.id, linkedEntityType: "MEDICATION_COURSE", linkedEntityId: course.id, relationship: "TREATED_BY" }, update: {} })
  ]);
  if (condition.aquariumId) await prisma.aquariumEvent.create({ data: { collectionId: collection.id, aquariumId: condition.aquariumId, relatedConditionId: condition.id, relatedMedicationCourseId: course.id, eventType: "CONDITION_LINKED_MEDICATION", title: `Medication linked to ${condition.title}`, summary: course.title, createdById: user.id } });
  await writeAuditLog({ collectionId: collection.id, entityType: "HealthCondition", entityId: condition.id, action: "CONDITION_MEDICATION_LINKED", after: { medicationCourseId: course.id }, createdById: user.id });
  revalidateCondition(condition.id, condition.aquariumId);
  await setFormFlash("Medication linked to condition.");
}

export async function completeConditionTask(formData: FormData) {
  const { user, collection, role } = await context(careRoles);
  const taskId = text(formData, "taskId");
  const notes = text(formData, "notes");
  if (!taskId || !notes) throw new Error("Follow-up notes are required.");
  const task = await prisma.careTask.findFirstOrThrow({ where: { id: taskId, careSchedule: { collectionId: collection.id }, relatedConditionId: { not: null } }, include: { relatedCondition: true } });
  if (!task.relatedCondition) throw new Error("Condition not found.");
  const statusValue = text(formData, "status");
  const status = statusValue && conditionStatuses.includes(statusValue as never) ? statusValue as HealthConditionStatus : null;
  if (role === "FISHKEEPER" && status) throw new Error("Aquarist access is required to change condition status.");
  const now = new Date();
  await prisma.$transaction([
    prisma.careTask.update({ where: { id: task.id }, data: { status: "COMPLETED", completedAt: now, completedById: user.id } }),
    prisma.healthConditionObservation.create({ data: { collectionId: collection.id, conditionId: task.relatedCondition.id, observedAt: now, status, notes, createdById: user.id } }),
    prisma.healthCondition.update({ where: { id: task.relatedCondition.id }, data: { lastObservedAt: now, ...(status ? { status, resolvedAt: status === "RESOLVED" ? now : null } : {}), updatedById: user.id } })
  ]);
  await writeAuditLog({ collectionId: collection.id, entityType: "CareTask", entityId: task.id, action: "CONDITION_CARE_TASK_COMPLETED", after: { conditionId: task.relatedCondition.id, status, notes }, createdById: user.id });
  revalidateCondition(task.relatedCondition.id, task.relatedCondition.aquariumId);
  await setFormFlash("Condition follow-up completed.");
}
