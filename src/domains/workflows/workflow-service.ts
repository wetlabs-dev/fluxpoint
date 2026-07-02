import { Prisma, type NotificationChannel, type PrismaClient, type WorkflowRunStatus, type WorkflowStepRun, type WorkflowStepRunStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { deliverNotification } from "@/domains/notifications/notification-service";
import { createAuditLog } from "@/domains/audit/audit-service";
import { normalizedStepType } from "@/domains/workflows/step-types";

const RUNNING_STATUSES: WorkflowRunStatus[] = ["RUNNING", "ACTIVE", "PAUSED"];
const OPEN_STEP_STATUSES: WorkflowStepRunStatus[] = ["READY", "WAITING", "DUE", "PENDING", "BLOCKED"];

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function asChannels(value: unknown): NotificationChannel[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is NotificationChannel => item === "EMAIL" || item === "PUSH");
}

export function activeWorkflowRunStatuses() {
  return RUNNING_STATUSES;
}

export function openWorkflowStepStatuses() {
  return OPEN_STEP_STATUSES;
}

export function stepTitle(step: Pick<WorkflowStepRun, "titleSnapshot"> & { workflowStep?: { title: string } | null }) {
  return step.titleSnapshot || step.workflowStep?.title || "Workflow step";
}

async function collectionRecipients(collectionId: string, db: PrismaClient) {
  const collection = await db.collection.findUnique({ where: { id: collectionId }, select: { ownerId: true, memberships: { where: { role: { in: ["COLLECTION_OWNER", "AQUARIST", "FISHKEEPER"] } }, select: { userId: true } } } });
  return collection ? [...new Set([collection.ownerId, ...collection.memberships.map((membership) => membership.userId)])] : [];
}

export async function templateBelongsToCollection(templateId: string, collectionId: string, db: PrismaClient = prisma) {
  return db.workflowTemplate.findFirst({ where: { id: templateId, OR: [{ collectionId }, { collectionId: null }] }, include: { steps: { orderBy: [{ sortOrder: "asc" }, { order: "asc" }] } } });
}

export async function startWorkflowRun(input: { collectionId: string; workflowTemplateId: string; aquariumId?: string | null; userId?: string; notes?: string | null }, db: PrismaClient = prisma) {
  const template = await templateBelongsToCollection(input.workflowTemplateId, input.collectionId, db);
  if (!template || template.status === "ARCHIVED") throw new Error("Workflow template is not available.");
  const aquarium = input.aquariumId ? await db.aquarium.findFirst({ where: { id: input.aquariumId, collectionId: input.collectionId }, select: { id: true, name: true, generatedName: true } }) : null;
  if (input.aquariumId && !aquarium) throw new Error("Aquarium not found.");

  const now = new Date();
  let cumulativeWait = 0;
  const steps = template.steps.map((step, index) => {
    cumulativeWait += step.waitAfterPreviousMinutes ?? 0;
    const dueAt = cumulativeWait > 0 ? addMinutes(now, cumulativeWait) : now;
    return {
      collectionId: input.collectionId,
      workflowStepId: step.id,
      status: dueAt <= now ? "READY" as const : "WAITING" as const,
      sortOrder: step.sortOrder || step.order || index + 1,
      titleSnapshot: step.title,
      descriptionSnapshot: step.description,
      stepTypeSnapshot: normalizedStepType(step.stepType),
      configSnapshot: step.config ?? Prisma.JsonNull,
      readyAt: dueAt <= now ? now : null,
      dueAt
    };
  });

  const run = await db.workflowRun.create({
    data: {
      collectionId: input.collectionId,
      workflowTemplateId: template.id,
      aquariumId: aquarium?.id,
      title: template.name,
      status: "RUNNING",
      startedById: input.userId,
      notes: input.notes,
      stepRuns: { create: steps }
    },
    include: { stepRuns: { include: { workflowStep: true }, orderBy: { sortOrder: "asc" } }, workflowTemplate: true, aquarium: true }
  });

  await scheduleWorkflowNotifications(run.id, db);
  if (aquarium) {
    await db.aquariumEvent.create({
      data: {
        collectionId: input.collectionId,
        aquariumId: aquarium.id,
        eventType: "WORKFLOW",
        title: `Workflow started: ${template.name}`,
        summary: input.notes || template.description,
        createdById: input.userId
      }
    });
  }
  await createAuditLog({ collectionId: input.collectionId, entityType: "WorkflowRun", entityId: run.id, action: "WORKFLOW_RUN_STARTED", summary: `Started workflow ${template.name}`, actorUserId: input.userId, after: run });
  return run;
}

export async function scheduleWorkflowNotifications(workflowRunId: string, db: PrismaClient = prisma) {
  const run = await db.workflowRun.findUnique({ where: { id: workflowRunId }, include: { stepRuns: { include: { workflowStep: true } } } });
  if (!run || !run.collectionId) return { scheduled: 0 };
  let scheduled = 0;
  for (const stepRun of run.stepRuns) {
    const channels = asChannels(stepRun.workflowStep.alertChannels);
    if (!channels.length) continue;
    const dueAt = stepRun.dueAt ?? run.startedAt;
    const offset = stepRun.workflowStep.alertOffsetMinutes ?? 0;
    const scheduledFor = addMinutes(dueAt, -offset);
    for (const channel of channels) {
      await db.workflowNotification.upsert({
        where: { channel_dedupeKey: { channel, dedupeKey: `workflow-step:${stepRun.id}:${channel}` } },
        update: { scheduledFor, status: "SCHEDULED", error: null },
        create: {
          collectionId: run.collectionId,
          workflowRunId: run.id,
          workflowStepRunId: stepRun.id,
          channel,
          title: stepRun.titleSnapshot || stepRun.workflowStep.title,
          body: stepRun.descriptionSnapshot || stepRun.workflowStep.description,
          scheduledFor,
          dedupeKey: `workflow-step:${stepRun.id}:${channel}`
        }
      });
      scheduled += 1;
    }
  }
  return { scheduled };
}

export async function refreshDueWorkflowSteps(now = new Date(), db: PrismaClient = prisma) {
  const result = await db.workflowStepRun.updateMany({
    where: { status: { in: ["WAITING", "PENDING"] }, dueAt: { lte: now }, workflowRun: { status: { in: RUNNING_STATUSES } } },
    data: { status: "DUE", readyAt: now }
  });
  return result.count;
}

export async function processDueWorkflowNotifications(now = new Date(), db: PrismaClient = prisma) {
  await refreshDueWorkflowSteps(now, db);
  const notifications = await db.workflowNotification.findMany({
    where: { status: "SCHEDULED", scheduledFor: { lte: now }, workflowRun: { status: { in: RUNNING_STATUSES } }, OR: [{ workflowStepRun: null }, { workflowStepRun: { status: { in: OPEN_STEP_STATUSES } } }] },
    include: { workflowRun: { include: { aquarium: true } }, workflowStepRun: true },
    orderBy: { scheduledFor: "asc" },
    take: 100
  });
  let sent = 0; let skipped = 0; let failed = 0;
  for (const notification of notifications) {
    if (!notification.collectionId) {
      await db.workflowNotification.update({ where: { id: notification.id }, data: { status: "SKIPPED", error: "Workflow notification is missing a collection." } });
      skipped += 1;
      continue;
    }
    try {
      const recipients = await collectionRecipients(notification.collectionId, db);
      await Promise.all(recipients.map((userId) => deliverNotification({
        userId,
        collectionId: notification.collectionId,
        type: "WORKFLOW_REMINDER",
        title: `Workflow step due: ${notification.title}`,
        body: notification.body || "A Fluxpoint workflow step needs attention.",
        url: `/workflows/runs/${notification.workflowRunId}`,
        dedupeKey: notification.dedupeKey,
        entityType: "WorkflowStepRun",
        entityId: notification.workflowStepRunId ?? notification.workflowRunId,
        channels: [notification.channel]
      }, db)));
      await db.workflowNotification.update({ where: { id: notification.id }, data: { status: recipients.length ? "SENT" : "SKIPPED", sentAt: recipients.length ? now : null } });
      sent += recipients.length ? 1 : 0;
      skipped += recipients.length ? 0 : 1;
    } catch (error) {
      await db.workflowNotification.update({ where: { id: notification.id }, data: { status: "FAILED", error: error instanceof Error ? error.message : String(error) } });
      failed += 1;
    }
  }
  return { scanned: notifications.length, sent, skipped, failed };
}

export async function completeWorkflowStepRun(input: { stepRunId: string; collectionId: string; userId?: string; action: "complete" | "skip"; notes?: string | null; result?: Prisma.InputJsonValue }, db: PrismaClient = prisma) {
  const stepRun = await db.workflowStepRun.findFirst({
    where: { id: input.stepRunId, collectionId: input.collectionId },
    include: { workflowRun: { include: { aquarium: true } }, workflowStep: true }
  });
  if (!stepRun) throw new Error("Workflow step not found.");
  const status = input.action === "complete" ? "COMPLETED" : "SKIPPED";
  const updated = await db.workflowStepRun.update({
    where: { id: stepRun.id },
    data: { status, completedAt: new Date(), completedById: input.userId, notes: input.notes, result: input.result ?? Prisma.JsonNull },
    include: { workflowRun: true, workflowStep: true }
  });
  await db.workflowNotification.updateMany({ where: { workflowStepRunId: stepRun.id, status: "SCHEDULED" }, data: { status: "CANCELLED" } });

  const type = normalizedStepType(stepRun.stepTypeSnapshot ?? stepRun.workflowStep.stepType);
  if (type === "LOG_EVENT" && stepRun.workflowRun.aquariumId) {
    const config = (stepRun.configSnapshot || {}) as { eventTitle?: string };
    await db.aquariumEvent.create({
      data: {
        collectionId: input.collectionId,
        aquariumId: stepRun.workflowRun.aquariumId,
        eventType: "WORKFLOW",
        title: config.eventTitle || stepTitle({ ...stepRun, workflowStep: stepRun.workflowStep }),
        summary: input.notes || stepRun.descriptionSnapshot || stepRun.workflowStep.description,
        createdById: input.userId
      }
    });
  }

  const remaining = await db.workflowStepRun.count({ where: { workflowRunId: stepRun.workflowRunId, status: { in: OPEN_STEP_STATUSES } } });
  if (remaining === 0) {
    await db.workflowRun.update({ where: { id: stepRun.workflowRunId }, data: { status: "COMPLETED", completedAt: new Date() } });
    await db.workflowNotification.updateMany({ where: { workflowRunId: stepRun.workflowRunId, status: "SCHEDULED" }, data: { status: "CANCELLED" } });
    if (stepRun.workflowRun.aquariumId) {
      await db.aquariumEvent.create({
        data: { collectionId: input.collectionId, aquariumId: stepRun.workflowRun.aquariumId, eventType: "WORKFLOW", title: `Workflow completed: ${stepRun.workflowRun.title || "Workflow"}`, createdById: input.userId }
      });
    }
  }
  await createAuditLog({ collectionId: input.collectionId, entityType: "WorkflowStepRun", entityId: stepRun.id, action: input.action === "complete" ? "WORKFLOW_STEP_COMPLETED" : "WORKFLOW_STEP_SKIPPED", summary: `${input.action === "complete" ? "Completed" : "Skipped"} workflow step ${stepTitle({ ...stepRun, workflowStep: stepRun.workflowStep })}`, actorUserId: input.userId, after: updated });
  return { stepRun: updated, remaining };
}

export async function cancelWorkflowRun(input: { workflowRunId: string; collectionId: string; userId?: string; notes?: string | null }, db: PrismaClient = prisma) {
  const run = await db.workflowRun.findFirst({ where: { id: input.workflowRunId, collectionId: input.collectionId }, include: { aquarium: true } });
  if (!run) throw new Error("Workflow run not found.");
  const updated = await db.workflowRun.update({ where: { id: run.id }, data: { status: "CANCELLED", cancelledAt: new Date(), notes: input.notes ?? run.notes } });
  await db.workflowStepRun.updateMany({ where: { workflowRunId: run.id, status: { in: OPEN_STEP_STATUSES } }, data: { status: "CANCELLED" } });
  await db.workflowNotification.updateMany({ where: { workflowRunId: run.id, status: "SCHEDULED" }, data: { status: "CANCELLED" } });
  if (run.aquariumId) await db.aquariumEvent.create({ data: { collectionId: input.collectionId, aquariumId: run.aquariumId, eventType: "WORKFLOW", title: `Workflow cancelled: ${run.title || "Workflow"}`, summary: input.notes, createdById: input.userId } });
  await createAuditLog({ collectionId: input.collectionId, entityType: "WorkflowRun", entityId: run.id, action: "WORKFLOW_RUN_CANCELLED", summary: `Cancelled workflow ${run.title || run.id}`, actorUserId: input.userId, after: updated });
  return updated;
}
