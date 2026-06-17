import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";

function toInputJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function writeAuditLog(input: {
  entityType: string;
  entityId: string;
  action: string;
  before?: unknown;
  after?: unknown;
  createdById?: string | null;
}) {
  return prisma.auditLog.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      before: toInputJson(input.before),
      after: toInputJson(input.after),
      createdById: input.createdById ?? undefined
    }
  });
}
