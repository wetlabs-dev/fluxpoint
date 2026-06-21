import type { AuditScope, AuditSeverity, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { AuditLogInput, SafeJson } from "@/domains/audit/audit-types";

const REDACTED = "[REDACTED]";
const MAX_DEPTH = 6;
const MAX_ARRAY_ITEMS = 50;
const MAX_OBJECT_KEYS = 80;
const MAX_STRING_LENGTH = 2_000;
const SENSITIVE_KEY = /(password|token|secret|api.?key|private.?key|session|cookie|authorization|smtp.?password|vapid.?private|openai.?key|aws.?secret|database.?url)/i;

export function sanitizeAuditDetails(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (value === undefined) return undefined;
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "string") return value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}… [truncated]` : value;
  if (value instanceof Date) return value.toISOString();
  if (depth >= MAX_DEPTH) return "[MAX DEPTH]";
  if (typeof value !== "object") return String(value);
  if (seen.has(value)) return "[CIRCULAR]";
  seen.add(value);

  if (Array.isArray(value)) {
    const result = value.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitizeAuditDetails(item, depth + 1, seen));
    if (value.length > MAX_ARRAY_ITEMS) result.push(`[${value.length - MAX_ARRAY_ITEMS} more items]`);
    return result;
  }

  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value).slice(0, MAX_OBJECT_KEYS)) {
    result[key] = SENSITIVE_KEY.test(key) ? REDACTED : sanitizeAuditDetails(item, depth + 1, seen);
  }
  if (Object.keys(value).length > MAX_OBJECT_KEYS) result._truncated = `${Object.keys(value).length - MAX_OBJECT_KEYS} more keys`;
  return result;
}

function toJson(value: unknown): SafeJson {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(sanitizeAuditDetails(value))) as Prisma.InputJsonValue;
}

function findCollectionId(value: unknown, depth = 0): string | null {
  if (!value || typeof value !== "object" || depth > 4) return null;
  if (!Array.isArray(value) && "collectionId" in value && typeof (value as { collectionId?: unknown }).collectionId === "string") return (value as { collectionId: string }).collectionId;
  for (const nested of Array.isArray(value) ? value : Object.values(value)) {
    const found = findCollectionId(nested, depth + 1);
    if (found) return found;
  }
  return null;
}

function defaultSeverity(action: string): AuditSeverity {
  if (/(DELETE|RESET|FAILED|REJECTED|BLOCKED|CRITICAL|DISABLED|REVOKED)/.test(action)) return /(DELETE|RESET|CRITICAL)/.test(action) ? "CRITICAL" : "WARNING";
  if (/(WARNING|RATE_LIMIT|FLAGGED|ARCHIVED|CANCELLED|SKIPPED)/.test(action)) return "WARNING";
  return "INFO";
}

function defaultScope(input: AuditLogInput, collectionId: string | null): AuditScope {
  if (input.scope) return input.scope;
  if (collectionId) return "COLLECTION";
  if (input.entityType === "User" || /PASSWORD|LOGIN|LOGOUT/.test(input.action)) return "USER";
  if (/^(Server|MaintenanceMode|Backup|RestorePlan|ServerIncident|ServerMetric|DataReset)/.test(input.entityType)) return "SERVER";
  return input.actorUserId || input.createdById ? "USER" : "SYSTEM";
}

function words(value: string) {
  return value.replaceAll("_", " ").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
}

export function getAuditEntityLabel(entityType: string, entityId?: string | null) {
  return entityId ? `${words(entityType)} · ${entityId}` : words(entityType);
}

export function formatAuditSummary(input: Pick<AuditLogInput, "action" | "entityType" | "entityId">) {
  const action = words(input.action).replace(/^./, (letter) => letter.toUpperCase());
  return `${action} ${getAuditEntityLabel(input.entityType, input.entityId)}`;
}

export async function createAuditLog(input: AuditLogInput) {
  const actorUserId = input.actorUserId ?? input.createdById ?? null;
  const actor = actorUserId ? await prisma.user.findUnique({ where: { id: actorUserId }, select: { email: true, name: true, serverRole: true } }) : null;
  const collectionId = input.collectionId ?? findCollectionId(input.after) ?? findCollectionId(input.before) ?? findCollectionId(input.details);
  const before = toJson(input.before);
  const after = toJson(input.after);
  const details = toJson(input.details ?? (before !== undefined || after !== undefined ? { before, after } : undefined));

  return prisma.auditLog.create({
    data: {
      actorUserId,
      actorEmail: actor?.email ?? input.actorEmail?.slice(0, 320),
      actorDisplayName: actor?.name ?? input.actorDisplayName?.slice(0, 200),
      actorRole: actor?.serverRole ?? input.actorRole?.slice(0, 100),
      collectionId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      summary: input.summary?.trim().slice(0, 500) || formatAuditSummary(input),
      details,
      metadata: toJson(input.metadata),
      before,
      after,
      ipAddress: input.ipAddress?.slice(0, 100),
      userAgent: input.userAgent?.slice(0, 500),
      requestId: input.requestId?.slice(0, 200),
      severity: input.severity ?? defaultSeverity(input.action),
      scope: defaultScope(input, collectionId)
    }
  });
}

export async function auditServerAction(input: Omit<AuditLogInput, "scope">) {
  return createAuditLog({ ...input, scope: "SERVER" });
}

export async function auditCollectionAction(input: Omit<AuditLogInput, "scope"> & { collectionId: string }) {
  return createAuditLog({ ...input, scope: "COLLECTION" });
}

export async function auditUserAction(input: Omit<AuditLogInput, "scope">) {
  return createAuditLog({ ...input, scope: "USER" });
}

export async function auditSystemEvent(input: Omit<AuditLogInput, "scope" | "actorUserId" | "createdById">) {
  return createAuditLog({ ...input, scope: input.collectionId ? "COLLECTION" : "SYSTEM" });
}
