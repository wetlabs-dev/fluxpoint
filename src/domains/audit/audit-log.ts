import { prisma } from "@/lib/db/prisma";

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
      before: input.before === undefined ? undefined : JSON.stringify(input.before),
      after: input.after === undefined ? undefined : JSON.stringify(input.after),
      createdById: input.createdById ?? undefined
    }
  });
}
