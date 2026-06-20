"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { requireServerAdmin } from "@/domains/server/server-admin";
import { writeAuditLog } from "@/domains/audit/audit-log";
import { applyBackupCleanup, deleteBackupRun, restoreOperatorSteps, validateBackupForRestore } from "@/domains/server/backup-service";
import { hashPassword } from "@/lib/auth/password";
import { isServerAdmin } from "@/domains/server/server-admin";
import { collectAndPersistServerMetrics } from "@/domains/server/server-metrics";

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

export async function collectServerMetricsNow() {
  const user = await adminUser();
  const snapshot = await collectAndPersistServerMetrics();
  await writeAuditLog({ entityType: "ServerMetricSnapshot", entityId: snapshot?.id ?? "disabled", action: "METRICS_COLLECTED_MANUALLY", createdById: user.id });
  revalidatePath("/server-maintenance");
}

export async function createServerUser(formData: FormData) {
  const actor = await adminUser();
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("temporaryPassword") || "");
  if (name.length < 2 || !email.includes("@") || password.length < 12) throw new Error("Name, valid email, and a 12-character temporary password are required.");
  const user = await prisma.user.create({ data: { name, email, passwordHash: await hashPassword(password) } });
  await writeAuditLog({ entityType: "User", entityId: user.id, action: "USER_CREATED", after: { name, email }, createdById: actor.id });
  revalidatePath("/server-maintenance/users");
}

export async function updateServerUser(formData: FormData) {
  const actor = await adminUser();
  const id = String(formData.get("id") || "");
  const before = await prisma.user.findUniqueOrThrow({ where: { id } });
  const name = String(formData.get("name") || before.name).trim();
  const password = String(formData.get("temporaryPassword") || "");
  const user = await prisma.user.update({ where: { id }, data: { name, ...(password ? { passwordHash: await hashPassword(password) } : {}) } });
  if (password) await prisma.session.deleteMany({ where: { userId: id } });
  await writeAuditLog({ entityType: "User", entityId: id, action: password ? "USER_PASSWORD_RESET" : "USER_UPDATED", before: { name: before.name }, after: { name: user.name }, createdById: actor.id });
  revalidatePath("/server-maintenance/users");
}

export async function toggleServerUser(formData: FormData) {
  const actor = await adminUser();
  const id = String(formData.get("id") || "");
  const target = await prisma.user.findUniqueOrThrow({ where: { id } });
  if (!target.disabledAt && await isServerAdmin(target)) throw new Error("The active server administrator cannot be disabled.");
  const disabledAt = target.disabledAt ? null : new Date();
  await prisma.user.update({ where: { id }, data: { disabledAt } });
  if (disabledAt) await prisma.session.deleteMany({ where: { userId: id } });
  await writeAuditLog({ entityType: "User", entityId: id, action: disabledAt ? "USER_DISABLED" : "USER_ENABLED", createdById: actor.id });
  revalidatePath("/server-maintenance/users");
}

export async function updateServerCollection(formData: FormData) {
  const actor = await adminUser();
  const id = String(formData.get("id") || "");
  const before = await prisma.collection.findUniqueOrThrow({ where: { id } });
  const record = await prisma.collection.update({ where: { id }, data: { name: String(formData.get("name") || before.name).trim(), description: String(formData.get("description") || "").trim() || null } });
  await writeAuditLog({ entityType: "Collection", entityId: id, action: "COLLECTION_UPDATED", before, after: record, createdById: actor.id });
  revalidatePath("/server-maintenance/collections");
}

export async function toggleServerCollectionArchive(formData: FormData) {
  const actor = await adminUser();
  const id = String(formData.get("id") || "");
  const before = await prisma.collection.findUniqueOrThrow({ where: { id } });
  const archivedAt = before.archivedAt ? null : new Date();
  await prisma.collection.update({ where: { id }, data: { archivedAt } });
  await writeAuditLog({ entityType: "Collection", entityId: id, action: archivedAt ? "COLLECTION_ARCHIVED" : "COLLECTION_RESTORED", createdById: actor.id });
  revalidatePath("/server-maintenance/collections");
}

export async function setCollectionMembership(formData: FormData) {
  const actor = await adminUser();
  const collectionId = String(formData.get("collectionId") || "");
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const role = String(formData.get("role") || "VIEWER") as "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const membership = await prisma.collectionMembership.upsert({ where: { collectionId_userId: { collectionId, userId: user.id } }, create: { collectionId, userId: user.id, role }, update: { role } });
  await writeAuditLog({ entityType: "CollectionMembership", entityId: membership.id, action: "MEMBERSHIP_SET", after: { collectionId, userId: user.id, role }, createdById: actor.id });
  revalidatePath("/server-maintenance/collections");
}

export async function removeCollectionMembership(formData: FormData) {
  const actor = await adminUser();
  const id = String(formData.get("id") || "");
  const membership = await prisma.collectionMembership.findUniqueOrThrow({ where: { id } });
  const collection = await prisma.collection.findUniqueOrThrow({ where: { id: membership.collectionId } });
  if (membership.userId === collection.ownerId) throw new Error("The collection owner membership cannot be removed.");
  await prisma.collectionMembership.delete({ where: { id } });
  await writeAuditLog({ entityType: "CollectionMembership", entityId: id, action: "MEMBERSHIP_REMOVED", before: membership, createdById: actor.id });
  revalidatePath("/server-maintenance/collections");
}
