import type { AuditScope, AuditSeverity, Prisma } from "@prisma/client";
import type { AuditEvent } from "@/domains/audit/audit-events";

export type AuditLogInput = {
  entityType: string;
  entityId?: string | null;
  action: AuditEvent;
  summary?: string;
  details?: unknown;
  metadata?: unknown;
  before?: unknown;
  after?: unknown;
  actorUserId?: string | null;
  createdById?: string | null;
  actorEmail?: string | null;
  actorDisplayName?: string | null;
  actorRole?: string | null;
  collectionId?: string | null;
  severity?: AuditSeverity;
  scope?: AuditScope;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
};

export type AuditLogFilters = {
  search?: string;
  from?: string;
  to?: string;
  scope?: AuditScope | "";
  collectionId?: string;
  actor?: string;
  entityType?: string;
  action?: string;
  severity?: AuditSeverity | "";
  page?: number;
  pageSize?: number;
};

export type AuditReadContext =
  | { viewerUserId: string; access: "server" }
  | { viewerUserId: string; access: "collection"; collectionId: string };

export type SafeJson = Prisma.InputJsonValue | undefined;
