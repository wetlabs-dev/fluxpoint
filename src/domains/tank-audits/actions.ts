"use server";

import type { TankAuditLineStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { canCancelTankAudit, canEditTankAudit, canFinalizeTankAudit, createTankAuditSession, finalizeTankAudit } from "@/domains/tank-audits/tank-audit-service";
import { getCollectionRole, requireCollectionRole, viewerRoles } from "@/domains/auth/permissions";
import { writeAuditLog } from "@/domains/audit/audit-log";
import { setFormFlash } from "@/lib/forms/form-flash";

function text(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function numberValue(formData: FormData, key: string) {
  const value = text(formData, key);
  if (value === null) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) throw new Error(`${key} must be zero or greater.`);
  return numeric;
}

function intValue(formData: FormData, key: string) {
  const value = numberValue(formData, key);
  return value === null ? null : Math.max(0, Math.round(value));
}

async function context(aquariumId: string) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  await requireCollectionRole(collection.id, viewerRoles);
  const aquarium = await prisma.aquarium.findFirstOrThrow({ where: { id: aquariumId, collectionId: collection.id }, select: { id: true, collectionId: true, name: true, generatedName: true } });
  const role = await getCollectionRole(user.id, collection.id);
  return { user, collection, aquarium, role };
}

export async function startTankAuditAction(formData: FormData) {
  const aquariumId = String(formData.get("aquariumId"));
  const { user, collection, role } = await context(aquariumId);
  if (!canFinalizeTankAudit(role)) throw new Error("Aquarist access is required to start a tank audit.");
  const session = await createTankAuditSession({ collectionId: collection.id, aquariumId, userId: user.id, title: text(formData, "title") });
  revalidatePath(`/aquariums/${aquariumId}`);
  revalidatePath(`/aquariums/${aquariumId}/audit`);
  redirect(`/aquariums/${aquariumId}/audit/${session.id}`);
}

export async function updateTankAuditLineAction(formData: FormData) {
  const aquariumId = String(formData.get("aquariumId"));
  const auditId = String(formData.get("auditId"));
  const lineId = String(formData.get("lineId"));
  const { user, collection, role } = await context(aquariumId);
  if (!canEditTankAudit(role)) throw new Error("Fishkeeper access is required to edit audit observations.");
  const session = await prisma.tankAuditSession.findFirstOrThrow({ where: { id: auditId, collectionId: collection.id, aquariumId, status: { in: ["OPEN", "IN_PROGRESS"] } } });
  const rawStatus = String(formData.get("quickStatus") ?? formData.get("status") ?? "PENDING");
  const status = ["PENDING", "CONFIRMED", "ADJUST", "MISSING", "REMOVE", "FOUND_EXTRA", "MAINTENANCE_NEEDED", "CONDITION_NOTED", "NO_CHANGE"].includes(rawStatus) ? rawStatus as TankAuditLineStatus : "PENDING";
  const observedQuantity = numberValue(formData, "observedQuantity");
  const line = await prisma.tankAuditLine.update({
    where: { id: lineId },
    data: {
      status,
      observedQuantity,
      notes: text(formData, "notes"),
      healthNotes: text(formData, "healthNotes"),
      growthNotes: text(formData, "growthNotes"),
      maintenanceNotes: text(formData, "maintenanceNotes"),
      createCondition: formData.get("createCondition") === "on",
      lossCount: numberValue(formData, "lossCount"),
      maleCountApprox: intValue(formData, "maleCountApprox"),
      femaleCountApprox: intValue(formData, "femaleCountApprox"),
      observedPlacementAction: status === "ADJUST" ? "ADJUST_QUANTITY" : status === "MISSING" ? "LOG_LOSS" : status === "REMOVE" ? "REMOVE_FROM_TANK" : status === "FOUND_EXTRA" ? "CREATE_ITEM" : status === "PENDING" ? null : "CONFIRM"
    }
  });
  if (session.status === "OPEN") await prisma.tankAuditSession.update({ where: { id: auditId }, data: { status: "IN_PROGRESS" } });
  await writeAuditLog({ collectionId: collection.id, entityType: "TankAuditLine", entityId: line.id, action: "TANK_AUDIT_LINE_SAVED", after: { status: line.status, observedQuantity: line.observedQuantity, hasNotes: Boolean(line.notes || line.healthNotes || line.growthNotes || line.maintenanceNotes) }, createdById: user.id });
  revalidatePath(`/aquariums/${aquariumId}/audit/${auditId}`);
  await setFormFlash(`Saved audit line: ${line.itemName}.`);
}

export async function addFoundExtraAuditLineAction(formData: FormData) {
  const aquariumId = String(formData.get("aquariumId"));
  const auditId = String(formData.get("auditId"));
  const { collection, role } = await context(aquariumId);
  if (!canEditTankAudit(role)) throw new Error("Fishkeeper access is required to add audit findings.");
  await prisma.tankAuditSession.findFirstOrThrow({ where: { id: auditId, collectionId: collection.id, aquariumId, status: { in: ["OPEN", "IN_PROGRESS"] } } });
  const itemName = text(formData, "itemName") ?? "Found extra item";
  const itemType = String(formData.get("itemType") ?? "OTHER");
  const observedQuantity = numberValue(formData, "observedQuantity") ?? 1;
  await prisma.tankAuditLine.create({
    data: {
      collectionId: collection.id,
      auditSessionId: auditId,
      itemSnapshot: { foundExtra: true },
      itemType: itemType as never,
      itemName,
      expectedQuantity: null,
      observedQuantity,
      status: "FOUND_EXTRA",
      notes: text(formData, "notes"),
      maleCountApprox: intValue(formData, "maleCountApprox"),
      femaleCountApprox: intValue(formData, "femaleCountApprox")
    }
  });
  await prisma.tankAuditSession.update({ where: { id: auditId }, data: { status: "IN_PROGRESS" } });
  revalidatePath(`/aquariums/${aquariumId}/audit/${auditId}`);
  await setFormFlash(`Added found-extra line: ${itemName}.`);
}

export async function cancelTankAuditAction(formData: FormData) {
  const aquariumId = String(formData.get("aquariumId"));
  const auditId = String(formData.get("auditId"));
  const { user, collection, role } = await context(aquariumId);
  if (!canCancelTankAudit(role)) throw new Error("Collection Owner access is required to cancel a tank audit.");
  const before = await prisma.tankAuditSession.findFirstOrThrow({ where: { id: auditId, collectionId: collection.id, aquariumId, status: { in: ["OPEN", "IN_PROGRESS"] } } });
  await prisma.tankAuditSession.update({ where: { id: auditId }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelledById: user.id, notes: text(formData, "notes") ?? before.notes } });
  await writeAuditLog({ collectionId: collection.id, entityType: "TankAuditSession", entityId: auditId, action: "TANK_AUDIT_CANCELLED", before, createdById: user.id });
  revalidatePath(`/aquariums/${aquariumId}/audit`);
  redirect(`/aquariums/${aquariumId}/audit`);
}

export async function finalizeTankAuditAction(formData: FormData) {
  const aquariumId = String(formData.get("aquariumId"));
  const auditId = String(formData.get("auditId"));
  const { user, collection, role } = await context(aquariumId);
  if (!canFinalizeTankAudit(role)) throw new Error("Aquarist access is required to finalize a tank audit.");
  await finalizeTankAudit({ collectionId: collection.id, aquariumId, auditId, userId: user.id });
  revalidatePath(`/aquariums/${aquariumId}`);
  revalidatePath(`/aquariums/${aquariumId}/audit/${auditId}`);
  revalidatePath("/inventory");
  await setFormFlash("Tank audit finalized and inventory true-up applied.");
}
