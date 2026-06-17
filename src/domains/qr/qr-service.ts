import { prisma } from "@/lib/db/prisma";

export function buildQrPayload(entityType: string, entityId: string) {
  return JSON.stringify({
    app: "fluxpoint",
    entityType,
    entityId,
    path: `/${entityType.toLowerCase()}/${entityId}`
  });
}

export async function ensureQrCode(entityType: string, entityId: string, label: string) {
  const existing = await prisma.qrCode.findFirst({ where: { entityType, entityId } });
  if (existing) return existing;

  return prisma.qrCode.create({
    data: {
      entityType,
      entityId,
      label,
      payload: buildQrPayload(entityType, entityId)
    }
  });
}
