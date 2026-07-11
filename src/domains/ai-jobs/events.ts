import type { AiJobEventType, AiJobStatus, Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

const forbiddenKey = /(authorization|api.?key|secret|token|base64|b64|binary|image.?data|chain.?of.?thought)/i;

function sanitize(value: unknown, depth = 0): Prisma.InputJsonValue | undefined {
  if (depth > 4 || value === undefined) return undefined;
  if (value === null) return undefined;
  if (typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return value.replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]").slice(0, 1000);
  if (Array.isArray(value)) return value.slice(0, 25).map((item) => sanitize(item, depth + 1) ?? null);
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !forbiddenKey.test(key))
      .slice(0, 30)
      .map(([key, item]) => [key, sanitize(item, depth + 1) ?? null]));
  }
  return String(value).slice(0, 1000);
}

export async function recordAiJobEvent(db: Db, input: {
  jobId: string;
  eventType: AiJobEventType;
  message: string;
  metadata?: unknown;
  attemptNumber?: number | null;
  statusSnapshot?: AiJobStatus | null;
}) {
  return db.aiJobEvent.create({ data: {
    aiJobId: input.jobId,
    eventType: input.eventType,
    message: input.message.replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]").slice(0, 500),
    metadata: sanitize(input.metadata),
    attemptNumber: input.attemptNumber,
    statusSnapshot: input.statusSnapshot
  } });
}
