"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { requireServerAdmin } from "@/domains/server/server-admin";
import { writeAuditLog } from "@/domains/audit/audit-log";
import { applyBackupCleanup, deleteBackupRun, restoreOperatorSteps, validateBackupForRestore } from "@/domains/server/backup-service";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { collectAndPersistServerMetrics } from "@/domains/server/server-metrics";
import { resetAppData } from "@/domains/server/data-reset";
import { setFormFlash } from "@/lib/forms/form-flash";
import { parseDateTimeInTimeZone, userTimeZone } from "@/lib/dates/user-timezone";

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
  const expectedReturnAt = expectedValue ? parseDateTimeInTimeZone(expectedValue, userTimeZone(user)) : null;
  const before = await prisma.maintenanceMode.findUnique({ where: { id: "global" } });
  const now = new Date();
  const record = await prisma.maintenanceMode.upsert({
    where: { id: "global" },
    update: { enabled, message, expectedReturnAt, ...(enabled ? { startedAt: before?.enabled ? before.startedAt : now, startedById: before?.enabled ? before.startedById : user.id, endedAt: null, endedById: null } : { endedAt: now, endedById: user.id }) },
    create: { id: "global", enabled, message, expectedReturnAt, startedAt: enabled ? now : null, startedById: enabled ? user.id : null, endedAt: enabled ? null : now, endedById: enabled ? null : user.id }
  });
  await writeAuditLog({ entityType: "MaintenanceMode", entityId: record.id, action: enabled ? "MAINTENANCE_ENABLED" : "MAINTENANCE_DISABLED", before, after: record, createdById: user.id });
  revalidatePath("/server-maintenance");
  await setFormFlash(`Maintenance mode ${enabled ? "enabled" : "disabled"}.`);
}

export async function requestSitewideBackup(formData: FormData) {
  const user = await adminUser();
  const notes = String(formData.get("notes") || "").trim().slice(0, 1000) || null;
  const request = await prisma.backupRequest.create({ data: { notes, requestedById: user.id, run: { create: {} } }, include: { run: true } });
  await writeAuditLog({ entityType: "BackupRequest", entityId: request.id, action: "BACKUP_REQUESTED", after: { notes, runId: request.run?.id }, createdById: user.id });
  revalidatePath("/server-maintenance");
  await setFormFlash("Sitewide backup requested.");
}

export async function removeBackup(formData: FormData) {
  const user = await adminUser();
  const runId = String(formData.get("runId") || "");
  if (String(formData.get("confirmation") || "") !== "DELETE") throw new Error("Type DELETE to remove a backup.");
  await deleteBackupRun(runId, user.id);
  revalidatePath("/server-maintenance");
  await setFormFlash("Backup removed.");
}

export async function cleanupBackups(formData: FormData) {
  const user = await adminUser();
  if (String(formData.get("confirmation") || "") !== "DELETE") throw new Error("Type DELETE to apply cleanup.");
  const days = Number(formData.get("retentionDays") || 180);
  await applyBackupCleanup(days, user.id);
  revalidatePath("/server-maintenance");
  await setFormFlash("Backup cleanup completed.");
}

export async function createRestorePlan(formData: FormData) {
  const user = await adminUser();
  const backupRunId = String(formData.get("backupRunId") || "");
  const notes = String(formData.get("notes") || "").trim().slice(0, 1000) || null;
  const run = await prisma.backupRun.findUniqueOrThrow({ where: { id: backupRunId } });
  const validation = await validateBackupForRestore(run.id);
  const plan = await prisma.restorePlan.create({ data: { backupRunId: run.id, requestedById: user.id, validation: validation as never, operatorSteps: restoreOperatorSteps(run), notes } });
  await writeAuditLog({ entityType: "RestorePlan", entityId: plan.id, action: "RESTORE_PLAN_CREATED", after: { backupRunId, readiness: validation.readiness }, createdById: user.id });
  await setFormFlash("Restore plan created.");
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
  await setFormFlash("Server incident resolved.");
}

export async function collectServerMetricsNow() {
  const user = await adminUser();
  const snapshot = await collectAndPersistServerMetrics();
  await writeAuditLog({ entityType: "ServerMetricSnapshot", entityId: snapshot?.id ?? "disabled", action: "METRICS_COLLECTED_MANUALLY", createdById: user.id });
  revalidatePath("/server-maintenance");
  await setFormFlash("Server metrics collected.");
}

export async function createServerUser(formData: FormData) {
  const actor = await adminUser();
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("temporaryPassword") || "");
  if (name.length < 2 || !email.includes("@") || password.length < 12) throw new Error("Name, valid email, and a 12-character temporary password are required.");
  const serverRole = String(formData.get("serverRole") || "STANDARD_USER") === "SERVER_ADMIN" ? "SERVER_ADMIN" : "STANDARD_USER";
  const user = await prisma.user.create({ data: { name, email, serverRole, passwordHash: await hashPassword(password) } });
  await writeAuditLog({ entityType: "User", entityId: user.id, action: "USER_CREATED", after: { name, email, serverRole }, createdById: actor.id });
  revalidatePath("/server-maintenance/users");
  await setFormFlash(`Created user: ${email}.`);
}

export async function updateServerUser(formData: FormData) {
  const actor = await adminUser();
  const id = String(formData.get("id") || "");
  const before = await prisma.user.findUniqueOrThrow({ where: { id } });
  const name = String(formData.get("name") || before.name).trim();
  const password = String(formData.get("temporaryPassword") || "");
  const serverRole = String(formData.get("serverRole") || before.serverRole) === "SERVER_ADMIN" ? "SERVER_ADMIN" : "STANDARD_USER";
  if (!before.disabledAt && before.serverRole === "SERVER_ADMIN" && serverRole !== "SERVER_ADMIN" && await prisma.user.count({ where: { serverRole: "SERVER_ADMIN", disabledAt: null } }) <= 1) throw new Error("The last enabled server admin cannot be demoted.");
  const user = await prisma.user.update({ where: { id }, data: { name, serverRole, ...(password ? { passwordHash: await hashPassword(password) } : {}) } });
  if (password) await prisma.session.deleteMany({ where: { userId: id } });
  await writeAuditLog({ entityType: "User", entityId: id, action: password ? "USER_PASSWORD_RESET" : "USER_UPDATED", before: { name: before.name, serverRole: before.serverRole }, after: { name: user.name, serverRole: user.serverRole }, createdById: actor.id });
  revalidatePath("/server-maintenance/users");
  await setFormFlash(`Saved user: ${before.email}.`);
}

export async function toggleServerUser(formData: FormData) {
  const actor = await adminUser();
  const id = String(formData.get("id") || "");
  const target = await prisma.user.findUniqueOrThrow({ where: { id } });
  if (id === actor.id && !target.disabledAt) throw new Error("You cannot disable your own account.");
  if (!target.disabledAt && target.serverRole === "SERVER_ADMIN" && await prisma.user.count({ where: { serverRole: "SERVER_ADMIN", disabledAt: null } }) <= 1) throw new Error("The last enabled server admin cannot be disabled.");
  const disabledAt = target.disabledAt ? null : new Date();
  await prisma.user.update({ where: { id }, data: { disabledAt } });
  if (disabledAt) await prisma.session.deleteMany({ where: { userId: id } });
  await writeAuditLog({ entityType: "User", entityId: id, action: disabledAt ? "USER_DISABLED" : "USER_ENABLED", createdById: actor.id });
  revalidatePath("/server-maintenance/users");
  await setFormFlash(`User ${disabledAt ? "disabled" : "enabled"}.`);
}

export async function deleteServerUser(formData: FormData) {
  const actor = await adminUser();
  const id = String(formData.get("id") || "");
  const target = await prisma.user.findUniqueOrThrow({ where: { id }, include: { _count: { select: { collections: true } } } });
  if (id === actor.id) throw new Error("You cannot delete your own account.");
  if (String(formData.get("confirmation") || "") !== `DELETE ${target.email}`) throw new Error(`Type DELETE ${target.email} to permanently delete this user.`);
  if (!target.disabledAt && target.serverRole === "SERVER_ADMIN" && await prisma.user.count({ where: { serverRole: "SERVER_ADMIN", disabledAt: null } }) <= 1) throw new Error("The last enabled server admin cannot be deleted.");
  if (target._count.collections > 0) throw new Error("Transfer or delete this user's owned collections before deleting the account.");
  await prisma.user.delete({ where: { id } });
  await writeAuditLog({ entityType: "User", entityId: id, action: "USER_DELETED_PERMANENTLY", before: { email: target.email, name: target.name, serverRole: target.serverRole }, createdById: actor.id });
  revalidatePath("/server-maintenance/users");
  await setFormFlash("User deleted.");
}

export async function createServerCollection(formData: FormData) {
  const actor = await adminUser();
  const ownerEmail = String(formData.get("ownerEmail") || "").trim().toLowerCase();
  const owner = await prisma.user.findUniqueOrThrow({ where: { email: ownerEmail } });
  if (owner.disabledAt) throw new Error("A disabled user cannot own a new collection.");
  const name = String(formData.get("name") || "").trim();
  if (name.length < 2) throw new Error("Collection name is required.");
  const collection = await prisma.collection.create({ data: { name, description: String(formData.get("description") || "").trim() || null, ownerId: owner.id, memberships: { create: { userId: owner.id, role: "COLLECTION_OWNER" } } } });
  await writeAuditLog({ collectionId: collection.id, scope: "COLLECTION", entityType: "Collection", entityId: collection.id, action: "COLLECTION_CREATED", after: { name, ownerEmail, collectionId: collection.id }, createdById: actor.id });
  revalidatePath("/server-maintenance/collections");
  await setFormFlash(`Created collection: ${collection.name}.`);
}

export async function updateServerCollection(formData: FormData) {
  const actor = await adminUser();
  const id = String(formData.get("id") || "");
  const before = await prisma.collection.findUniqueOrThrow({ where: { id } });
  const record = await prisma.collection.update({ where: { id }, data: { name: String(formData.get("name") || before.name).trim(), description: String(formData.get("description") || "").trim() || null } });
  await writeAuditLog({ collectionId: id, scope: "COLLECTION", entityType: "Collection", entityId: id, action: "COLLECTION_UPDATED", before, after: record, createdById: actor.id });
  revalidatePath("/server-maintenance/collections");
  await setFormFlash(`Saved collection: ${record.name}.`);
}

export async function toggleServerCollectionArchive(formData: FormData) {
  const actor = await adminUser();
  const id = String(formData.get("id") || "");
  const before = await prisma.collection.findUniqueOrThrow({ where: { id } });
  const archivedAt = before.archivedAt ? null : new Date();
  await prisma.collection.update({ where: { id }, data: { archivedAt } });
  await writeAuditLog({ collectionId: id, scope: "COLLECTION", entityType: "Collection", entityId: id, action: archivedAt ? "COLLECTION_ARCHIVED" : "COLLECTION_RESTORED", after: { archivedAt }, createdById: actor.id });
  revalidatePath("/server-maintenance/collections");
  await setFormFlash(`Collection ${archivedAt ? "archived" : "restored"}.`);
}

export async function deleteServerCollection(formData: FormData) {
  const actor = await adminUser();
  const id = String(formData.get("id") || "");
  const collection = await prisma.collection.findUniqueOrThrow({ where: { id } });
  if (String(formData.get("confirmation") || "") !== `DELETE ${collection.name}`) throw new Error(`Type DELETE ${collection.name} to permanently delete this collection.`);
  await prisma.collection.delete({ where: { id } });
  await writeAuditLog({ scope: "COLLECTION", entityType: "Collection", entityId: id, action: "COLLECTION_DELETED_PERMANENTLY", summary: `Permanently deleted collection ${collection.name}`, before: { name: collection.name, ownerId: collection.ownerId }, createdById: actor.id });
  revalidatePath("/server-maintenance/collections");
  await setFormFlash("Collection deleted.");
}

export async function transferCollectionOwnership(formData: FormData) {
  const actor = await adminUser();
  const collectionId = String(formData.get("collectionId") || "");
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const nextOwner = await prisma.user.findUniqueOrThrow({ where: { email } });
  const before = await prisma.collection.findUniqueOrThrow({ where: { id: collectionId } });
  if (nextOwner.disabledAt) throw new Error("A disabled user cannot own a collection.");
  if (nextOwner.id === before.ownerId) throw new Error("That user already owns this collection.");
  await prisma.$transaction([
    prisma.collectionMembership.upsert({ where: { collectionId_userId: { collectionId, userId: nextOwner.id } }, create: { collectionId, userId: nextOwner.id, role: "COLLECTION_OWNER" }, update: { role: "COLLECTION_OWNER" } }),
    prisma.collectionMembership.updateMany({ where: { collectionId, userId: before.ownerId }, data: { role: "AQUARIST" } }),
    prisma.collection.update({ where: { id: collectionId }, data: { ownerId: nextOwner.id } })
  ]);
  await writeAuditLog({ collectionId, scope: "COLLECTION", entityType: "Collection", entityId: collectionId, action: "OWNERSHIP_TRANSFERRED", before: { ownerId: before.ownerId }, after: { ownerId: nextOwner.id, ownerEmail: email }, createdById: actor.id });
  revalidatePath("/server-maintenance/collections");
  revalidatePath("/server-maintenance/users");
  await setFormFlash("Collection ownership transferred.");
}

export async function setCollectionMembership(formData: FormData) {
  const actor = await adminUser();
  const collectionId = String(formData.get("collectionId") || "");
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const role = String(formData.get("role") || "VIEWER") as "COLLECTION_OWNER" | "AQUARIST" | "FISHKEEPER" | "VIEWER";
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const collection = await prisma.collection.findUniqueOrThrow({ where: { id: collectionId } });
  const existing = await prisma.collectionMembership.findUnique({ where: { collectionId_userId: { collectionId, userId: user.id } } });
  if (user.id === collection.ownerId && role !== "COLLECTION_OWNER") throw new Error("Transfer primary ownership before changing the owner's membership role.");
  if (existing?.role === "COLLECTION_OWNER" && role !== "COLLECTION_OWNER" && await prisma.collectionMembership.count({ where: { collectionId, role: "COLLECTION_OWNER" } }) <= 1) throw new Error("Every collection must retain at least one Collection Owner.");
  const membership = await prisma.collectionMembership.upsert({ where: { collectionId_userId: { collectionId, userId: user.id } }, create: { collectionId, userId: user.id, role }, update: { role } });
  await writeAuditLog({ collectionId, scope: "COLLECTION", entityType: "CollectionMembership", entityId: membership.id, action: existing ? "MEMBER_ROLE_CHANGED" : "MEMBER_ADDED", before: existing, after: { userId: user.id, role }, createdById: actor.id });
  revalidatePath("/server-maintenance/collections");
  await setFormFlash(existing ? "Collection membership updated." : "Collection member added.");
}

export async function removeCollectionMembership(formData: FormData) {
  const actor = await adminUser();
  const id = String(formData.get("id") || "");
  const membership = await prisma.collectionMembership.findUniqueOrThrow({ where: { id } });
  const collection = await prisma.collection.findUniqueOrThrow({ where: { id: membership.collectionId } });
  if (membership.userId === collection.ownerId) throw new Error("Transfer primary ownership before removing this membership.");
  if (membership.role === "COLLECTION_OWNER" && await prisma.collectionMembership.count({ where: { collectionId: membership.collectionId, role: "COLLECTION_OWNER" } }) <= 1) throw new Error("Every collection must retain at least one Collection Owner.");
  await prisma.collectionMembership.delete({ where: { id } });
  await writeAuditLog({ collectionId: membership.collectionId, scope: "COLLECTION", entityType: "CollectionMembership", entityId: id, action: "MEMBERSHIP_REMOVED", before: membership, createdById: actor.id });
  revalidatePath("/server-maintenance/collections");
  await setFormFlash("Collection member removed.");
}

export async function resetApplicationDataAction(formData: FormData) {
  const actor = await adminUser();
  if (String(formData.get("confirmation") || "") !== "RESET FLUXPOINT") throw new Error("Type RESET FLUXPOINT exactly to continue.");
  const password = String(formData.get("currentPassword") || "");
  const freshActor = await prisma.user.findUniqueOrThrow({ where: { id: actor.id } });
  if (!(await verifyPassword(password, freshActor.passwordHash))) throw new Error("Current password did not match.");
  const preserveMode = String(formData.get("preserveMode") || "all");
  const preserveUserEmails = preserveMode === "selected" ? formData.getAll("preserveUserEmail").map(String) : [];
  if (preserveMode === "selected" && !preserveUserEmails.map((email) => email.toLowerCase()).includes(actor.email.toLowerCase())) throw new Error("Your current administrator account must be preserved.");
  await resetAppData({ preserveAllUsers: preserveMode !== "selected", preserveUserEmails, deleteNonPreservedUsers: preserveMode === "selected", createDefaultCollection: formData.get("createDefaultCollection") === "on", deleteFiles: formData.get("deleteFiles") === "on", deleteOperationalData: formData.get("deleteOperationalData") === "on", deleteBackupMetadata: formData.get("deleteBackupMetadata") === "on", actorUserId: actor.id });
  redirect("/dashboard");
}
