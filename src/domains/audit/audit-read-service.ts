import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getCollectionRole, isServerAdmin } from "@/domains/auth/permissions";
import type { AuditLogFilters, AuditReadContext } from "@/domains/audit/audit-types";

export async function getAuditLogs(context: AuditReadContext, filters: AuditLogFilters = {}) {
  if (context.access === "server") {
    if (!(await isServerAdmin(context.viewerUserId))) throw new Error("Server administrator access is required.");
  } else {
    const role = await getCollectionRole(context.viewerUserId, context.collectionId);
    if (role !== "COLLECTION_OWNER" && !(await isServerAdmin(context.viewerUserId))) throw new Error("Collection owner access is required.");
  }

  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 50));
  const page = Math.max(1, filters.page ?? 1);
  const search = filters.search?.trim().slice(0, 200);
  const actor = filters.actor?.trim().slice(0, 200);
  const from = auditDate(filters.from, false);
  const to = auditDate(filters.to, true);
  const where: Prisma.AuditLogWhereInput = {
    ...(context.access === "collection" ? { collectionId: context.collectionId } : filters.collectionId ? { collectionId: filters.collectionId } : {}),
    ...(filters.scope ? { scope: filters.scope } : {}),
    ...(filters.severity ? { severity: filters.severity } : {}),
    ...(filters.entityType ? { entityType: filters.entityType } : {}),
    ...(filters.action ? { action: filters.action } : {}),
    ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
    ...(actor ? { OR: [{ actorUserId: actor }, { actorEmail: { contains: actor, mode: "insensitive" } }, { actorDisplayName: { contains: actor, mode: "insensitive" } }] } : {}),
    ...(search ? { AND: [{ OR: [
      { summary: { contains: search, mode: "insensitive" } },
      { action: { contains: search, mode: "insensitive" } },
      { entityType: { contains: search, mode: "insensitive" } },
      { entityId: { contains: search, mode: "insensitive" } },
      { actorEmail: { contains: search, mode: "insensitive" } },
      { actorDisplayName: { contains: search, mode: "insensitive" } },
      { collection: { name: { contains: search, mode: "insensitive" } } }
    ] }] } : {})
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({ where, include: { actor: { select: { id: true, email: true, name: true } }, collection: { select: { id: true, name: true } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
    prisma.auditLog.count({ where })
  ]);
  return { logs, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

function auditDate(value: string | undefined, endOfDay: boolean) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00"}`);
  return Number.isNaN(date.getTime()) ? null : date;
}
