import { notFound } from "next/navigation";
import type { AuditScope, AuditSeverity } from "@prisma/client";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { isServerAdmin } from "@/domains/server/server-admin";
import { getAuditLogs } from "@/domains/audit/audit-read-service";
import type { AuditLogFilters } from "@/domains/audit/audit-types";
import { PageHeader } from "@/components/layout/page-header";
import { AuditLogView } from "@/components/audit/AuditLogView";

export const dynamic = "force-dynamic";

export default async function ServerAuditLogPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  if (!(await isServerAdmin(user))) notFound();
  const filters = filtersFromParams(await searchParams);
  const [result, collections, entityRows, actionRows] = await Promise.all([
    getAuditLogs({ viewerUserId: user.id, access: "server" }, filters),
    prisma.collection.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.auditLog.findMany({ distinct: ["entityType"], select: { entityType: true }, orderBy: { entityType: "asc" } }),
    prisma.auditLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } })
  ]);
  return <div className="space-y-6"><PageHeader title="Audit Log" eyebrow="Server administration" /><AuditLogView {...result} filters={filters} basePath="/server-maintenance/audit-log" serverView collections={collections.map((item) => ({ value: item.id, label: item.name }))} entityTypes={entityRows.map((item) => item.entityType)} actions={actionRows.map((item) => item.action)} /></div>;
}

function one(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function filtersFromParams(params: Record<string, string | string[] | undefined>): AuditLogFilters {
  const scope = one(params.scope); const severity = one(params.severity); const page = Number(one(params.page) || 1);
  return { search: one(params.search), from: one(params.from), to: one(params.to), scope: ["SERVER", "COLLECTION", "USER", "SYSTEM"].includes(scope || "") ? scope as AuditScope : "", collectionId: one(params.collectionId), actor: one(params.actor), entityType: one(params.entityType), action: one(params.action), severity: ["INFO", "WARNING", "CRITICAL"].includes(severity || "") ? severity as AuditSeverity : "", page: Number.isFinite(page) ? page : 1 };
}
