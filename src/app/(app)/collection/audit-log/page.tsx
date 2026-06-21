import { notFound } from "next/navigation";
import type { AuditScope, AuditSeverity } from "@prisma/client";
import { getUserCollection, requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getCollectionRole } from "@/domains/auth/permissions";
import { getAuditLogs } from "@/domains/audit/audit-read-service";
import type { AuditLogFilters } from "@/domains/audit/audit-types";
import { PageHeader } from "@/components/layout/page-header";
import { AuditLogView } from "@/components/audit/AuditLogView";

export const dynamic = "force-dynamic";

export default async function CollectionAuditLogPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const collection = await getUserCollection(user.id);
  if (await getCollectionRole(user.id, collection.id) !== "COLLECTION_OWNER") notFound();
  const filters = filtersFromParams(await searchParams);
  const [result, entityRows, actionRows] = await Promise.all([
    getAuditLogs({ viewerUserId: user.id, access: "collection", collectionId: collection.id }, filters),
    prisma.auditLog.findMany({ where: { collectionId: collection.id }, distinct: ["entityType"], select: { entityType: true }, orderBy: { entityType: "asc" } }),
    prisma.auditLog.findMany({ where: { collectionId: collection.id }, distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } })
  ]);
  return <div className="space-y-6"><PageHeader title="Collection Audit Log" eyebrow={collection.name} /><AuditLogView {...result} filters={filters} basePath="/collection/audit-log" serverView={false} entityTypes={entityRows.map((item) => item.entityType)} actions={actionRows.map((item) => item.action)} /></div>;
}

function one(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function filtersFromParams(params: Record<string, string | string[] | undefined>): AuditLogFilters {
  const scope = one(params.scope); const severity = one(params.severity); const page = Number(one(params.page) || 1);
  return { search: one(params.search), from: one(params.from), to: one(params.to), scope: ["SERVER", "COLLECTION", "USER", "SYSTEM"].includes(scope || "") ? scope as AuditScope : "", actor: one(params.actor), entityType: one(params.entityType), action: one(params.action), severity: ["INFO", "WARNING", "CRITICAL"].includes(severity || "") ? severity as AuditSeverity : "", page: Number.isFinite(page) ? page : 1 };
}
