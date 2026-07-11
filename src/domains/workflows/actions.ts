"use server";

import { Prisma, type NotificationChannel, type WorkflowCategory, type WorkflowStepType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { requireCollectionRole, careRoles, structuralRoles, collectionOwnerRoles } from "@/domains/auth/permissions";
import { createAuditLog } from "@/domains/audit/audit-service";
import { ensureDefaultWorkflowTemplates } from "@/domains/workflows/defaults";
import { cancelWorkflowRun, completeWorkflowStepRun, startWorkflowRun } from "@/domains/workflows/workflow-service";
import { setFormFlash } from "@/lib/forms/form-flash";

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function intValue(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : null;
}

function valueAt(values: FormDataEntryValue[], index: number) {
  return String(values[index] ?? "").trim();
}

function categories(value: string | null): WorkflowCategory {
  const allowed: WorkflowCategory[] = ["MAINTENANCE", "QUARANTINE", "MEDICATION", "BREEDING", "CYCLING", "ACCLIMATION", "VACATION", "CUSTOM"];
  return allowed.includes(value as WorkflowCategory) ? value as WorkflowCategory : "CUSTOM";
}

function stepType(value: string): WorkflowStepType {
  const allowed: WorkflowStepType[] = ["INSTRUCTION", "MEASUREMENT", "WAIT", "ALERT", "CHECKLIST", "LOG_EVENT"];
  return allowed.includes(value as WorkflowStepType) ? value as WorkflowStepType : "INSTRUCTION";
}

function configFor(formData: FormData, index: number, type: WorkflowStepType): Prisma.InputJsonValue {
  const config: Record<string, unknown> = {};
  const names = ["measurementLabel", "unit", "targetValue", "minValue", "maxValue", "eventTitle", "checklistItems"];
  for (const name of names) {
    const value = valueAt(formData.getAll(`step${name[0].toUpperCase()}${name.slice(1)}`), index);
    if (!value) continue;
    if (name === "checklistItems") config.items = value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
    else config[name] = value;
  }
  if (type === "WAIT") config.waitMinutes = intValue(valueAt(formData.getAll("stepWaitAfterPreviousMinutes"), index)) ?? 0;
  return JSON.parse(JSON.stringify(config)) as Prisma.InputJsonValue;
}

function stepRows(formData: FormData) {
  const titles = formData.getAll("stepTitle");
  const descriptions = formData.getAll("stepDescription");
  const types = formData.getAll("stepType");
  const waits = formData.getAll("stepWaitAfterPreviousMinutes");
  const alertOffsets = formData.getAll("stepAlertOffsetMinutes");
  const required = new Set(formData.getAll("stepRequired").map(String));
  const email = new Set(formData.getAll("stepAlertEmail").map(String));
  const push = new Set(formData.getAll("stepAlertPush").map(String));
  return titles.map((entry, index) => {
    const title = String(entry ?? "").trim();
    if (!title) return null;
    const type = stepType(valueAt(types, index));
    const channels: NotificationChannel[] = [];
    if (email.has(String(index))) channels.push("EMAIL");
    if (push.has(String(index))) channels.push("PUSH");
    return {
      order: index + 1,
      sortOrder: index + 1,
      title,
      description: valueAt(descriptions, index) || null,
      stepType: type,
      waitAfterPreviousMinutes: intValue(valueAt(waits, index)),
      alertOffsetMinutes: intValue(valueAt(alertOffsets, index)),
      alertChannels: channels.length ? channels : Prisma.JsonNull,
      isRequired: required.has(String(index)),
      config: configFor(formData, index, type)
    };
  }).filter(Boolean) as Array<{
    order: number;
    sortOrder: number;
    title: string;
    description: string | null;
    stepType: WorkflowStepType;
    waitAfterPreviousMinutes: number | null;
    alertOffsetMinutes: number | null;
    alertChannels: Prisma.InputJsonValue;
    isRequired: boolean;
    config: Prisma.InputJsonValue;
  }>;
}

async function collectionForWrite(roles = structuralRoles) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  await requireCollectionRole(collection.id, roles);
  return { user, collection };
}

export async function createWorkflowTemplate(formData: FormData) {
  const { user, collection } = await collectionForWrite(structuralRoles);
  const steps = stepRows(formData);
  if (!steps.length) throw new Error("Add at least one workflow step.");
  const template = await prisma.workflowTemplate.create({
    data: {
      collectionId: collection.id,
      name: text(formData, "name") || "Untitled workflow",
      description: text(formData, "description"),
      category: categories(text(formData, "category")),
      defaultAquariumId: text(formData, "defaultAquariumId"),
      defaultDurationMinutes: intValue(formData.get("defaultDurationMinutes")),
      createdById: user.id,
      steps: { create: steps }
    }
  });
  await createAuditLog({ collectionId: collection.id, entityType: "WorkflowTemplate", entityId: template.id, action: "WORKFLOW_TEMPLATE_CREATED", actorUserId: user.id, after: template });
  revalidatePath("/workflows");
  await setFormFlash(`Created workflow template: ${template.name}.`);
  redirect("/workflows");
}

export async function updateWorkflowTemplate(formData: FormData) {
  const { user, collection } = await collectionForWrite(structuralRoles);
  const id = String(formData.get("id"));
  const existing = await prisma.workflowTemplate.findFirstOrThrow({ where: { id, collectionId: collection.id } });
  const steps = stepRows(formData);
  if (!steps.length) throw new Error("Add at least one workflow step.");
  const template = await prisma.workflowTemplate.update({
    where: { id },
    data: {
      name: text(formData, "name") || existing.name,
      description: text(formData, "description"),
      category: categories(text(formData, "category")),
      defaultAquariumId: text(formData, "defaultAquariumId"),
      defaultDurationMinutes: intValue(formData.get("defaultDurationMinutes")),
      steps: { deleteMany: {}, create: steps }
    }
  });
  await createAuditLog({ collectionId: collection.id, entityType: "WorkflowTemplate", entityId: template.id, action: "WORKFLOW_TEMPLATE_UPDATED", actorUserId: user.id, before: existing, after: template });
  revalidatePath("/workflows");
  await setFormFlash(`Updated workflow template: ${template.name}.`);
  redirect("/workflows");
}

export async function archiveWorkflowTemplate(formData: FormData) {
  const { user, collection } = await collectionForWrite(collectionOwnerRoles);
  const id = String(formData.get("id"));
  const template = await prisma.workflowTemplate.findFirstOrThrow({ where: { id, collectionId: collection.id } });
  await prisma.workflowTemplate.update({ where: { id }, data: { status: "ARCHIVED" } });
  await createAuditLog({ collectionId: collection.id, entityType: "WorkflowTemplate", entityId: id, action: "WORKFLOW_TEMPLATE_ARCHIVED", actorUserId: user.id, before: template });
  revalidatePath("/workflows");
  await setFormFlash(`Archived workflow template: ${template.name}.`);
}

export async function startWorkflowTemplate(formData: FormData) {
  const { user, collection } = await collectionForWrite(careRoles);
  const run = await startWorkflowRun({ collectionId: collection.id, workflowTemplateId: String(formData.get("workflowTemplateId")), aquariumId: text(formData, "aquariumId"), userId: user.id, notes: text(formData, "notes") });
  revalidatePath("/workflows");
  if (run.aquariumId) revalidatePath(`/aquariums/${run.aquariumId}`);
  await setFormFlash(`Started workflow: ${run.title}.`);
  redirect(`/workflows/runs/${run.id}`);
}

export async function completeWorkflowStep(formData: FormData) {
  const { user, collection } = await collectionForWrite(careRoles);
  const result: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("result.")) result[key.slice(7)] = String(value).trim();
  }
  const output = await completeWorkflowStepRun({ stepRunId: String(formData.get("id")), collectionId: collection.id, userId: user.id, action: "complete", notes: text(formData, "notes"), result: JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue });
  revalidatePath(`/workflows/runs/${output.stepRun.workflowRunId}`);
  revalidatePath("/workflows");
  await setFormFlash(output.remaining === 0 ? "Workflow completed." : "Workflow step completed.");
}

export async function skipWorkflowStep(formData: FormData) {
  const { user, collection } = await collectionForWrite(careRoles);
  const output = await completeWorkflowStepRun({ stepRunId: String(formData.get("id")), collectionId: collection.id, userId: user.id, action: "skip", notes: text(formData, "notes") });
  revalidatePath(`/workflows/runs/${output.stepRun.workflowRunId}`);
  revalidatePath("/workflows");
  await setFormFlash(output.remaining === 0 ? "Workflow completed." : "Workflow step skipped.");
}

export async function cancelWorkflow(formData: FormData) {
  const { user, collection } = await collectionForWrite(careRoles);
  const run = await cancelWorkflowRun({ workflowRunId: String(formData.get("id")), collectionId: collection.id, userId: user.id, notes: text(formData, "notes") });
  revalidatePath(`/workflows/runs/${run.id}`);
  revalidatePath("/workflows");
  await setFormFlash("Workflow cancelled.");
}

export async function restoreDefaultWorkflows() {
  const { user, collection } = await collectionForWrite(collectionOwnerRoles);
  const templates = await ensureDefaultWorkflowTemplates(collection.id, user.id);
  await createAuditLog({ collectionId: collection.id, entityType: "WorkflowTemplate", action: "DEFAULT_WORKFLOWS_RESTORED", actorUserId: user.id, metadata: { count: templates.length } });
  revalidatePath("/workflows");
  revalidatePath("/server-maintenance");
  await setFormFlash(`Default workflow templates available: ${templates.length}.`);
}
