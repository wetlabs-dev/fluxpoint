"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { requireServerAdmin } from "@/domains/server/server-admin";
import { writeAuditLog } from "@/domains/audit/audit-log";
import { applyBackupCleanup, deleteBackupRun, restoreOperatorSteps, validateBackupForRestore } from "@/domains/server/backup-service";

async function adminUser() {
  const user = await requireUser();
  await requireServerAdmin(user);
  return user;
}

export async function updateMaintenanceMode(formData: FormData) {
  const user = await adminUser();
  const enabled = String(formData.get("enabled")) === "true";
  const message = String(formData.get("message") || "").trim().slice(0, 1000) || null;
  const expectedValue = String(formData.get("expectedReturnAt") || "");
  const expectedReturnAt = expectedValue ? new Date(expectedValue) : null;
  const before = await prisma.maintenanceMode.findUnique({ where: { id: "global" } });
  const now = new Date();
  const record = await prisma.maintenanceMode.upsert({
    where: { id: "global" },
    update: { enabled, message, expectedReturnAt, ...(enabled ? { startedAt: before?.enabled ? before.startedAt : now, startedById: before?.enabled ? before.startedById : user.id, endedAt: null, endedById: null } : { endedAt: now, endedById: user.id }) },
    create: { id: "global", enabled, message, expectedReturnAt, startedAt: enabled ? now : null, startedById: enabled ? user.id : null, endedAt: enabled ? null : now, endedById: enabled ? null : user.id }
  });
  await writeAuditLog({ entityType: "MaintenanceMode", entityId: record.id, action: enabled ? "MAINTENANCE_ENABLED" : "MAINTENANCE_DISABLED", before, after: record, createdById: user.id });
  revalidatePath("/server-maintenance");
}

export async function requestSitewideBackup(formData: FormData) {
  const user = await adminUser();
  const notes = String(formData.get("notes") || "").trim().slice(0, 1000) || null;
  const request = await prisma.backupRequest.create({ data: { notes, requestedById: user.id, run: { create: {} } }, include: { run: true } });
  await writeAuditLog({ entityType: "BackupRequest", entityId: request.id, action: "BACKUP_REQUESTED", after: { notes, runId: request.run?.id }, createdById: user.id });
  revalidatePath("/server-maintenance");
}

export async function removeBackup(formData: FormData) {
  const user = await adminUser();
  const runId = String(formData.get("runId") || "");
  if (String(formData.get("confirmation") || "") !== "DELETE") throw new Error("Type DELETE to remove a backup.");
  await deleteBackupRun(runId, user.id);
  revalidatePath("/server-maintenance");
}

export async function cleanupBackups(formData: FormData) {
  const user = await adminUser();
  if (String(formData.get("confirmation") || "") !== "DELETE") throw new Error("Type DELETE to apply cleanup.");
  const days = Number(formData.get("retentionDays") || 180);
  await applyBackupCleanup(days, user.id);
  revalidatePath("/server-maintenance");
}

export async function createRestorePlan(formData: FormData) {
  const user = await adminUser();
  const backupRunId = String(formData.get("backupRunId") || "");
  const notes = String(formData.get("notes") || "").trim().slice(0, 1000) || null;
  const run = await prisma.backupRun.findUniqueOrThrow({ where: { id: backupRunId } });
  const validation = await validateBackupForRestore(run.id);
  const plan = await prisma.restorePlan.create({ data: { backupRunId: run.id, requestedById: user.id, validation: validation as never, operatorSteps: restoreOperatorSteps(run), notes } });
  await writeAuditLog({ entityType: "RestorePlan", entityId: plan.id, action: "RESTORE_PLAN_CREATED", after: { backupRunId, readiness: validation.readiness }, createdById: user.id });
  redirect(`/server-maintenance?backup=${run.id}#restore-planning`);
}

export async function resolveIncident(formData: FormData) {
  const user = await adminUser();
  const id = String(formData.get("id") || "");
  const before = await prisma.serverIncident.findUniqueOrThrow({ where: { id } });
  if (before.status === "RESOLVED") return;
  const resolvedAt = new Date();
  const incident = await prisma.serverIncident.update({ where: { id }, data: { status: "RESOLVED", resolvedAt, durationSeconds: Math.max(0, Math.round((resolvedAt.getTime() - before.detectedAt.getTime()) / 1000)) } });
  await writeAuditLog({ entityType: "ServerIncident", entityId: id, action: "INCIDENT_RESOLVED_MANUALLY", before, after: incident, createdById: user.id });
  revalidatePath("/server-maintenance");
}
