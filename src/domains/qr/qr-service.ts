import { randomBytes } from "crypto";
import { prisma } from "@/lib/db/prisma";
import { appUrl } from "@/domains/email/email-service";

export const scannableEntityTypes = ["TANK", "INVENTORY", "EQUIPMENT", "SPECIES"] as const;
export type ScannableEntityType = typeof scannableEntityTypes[number];

export function normalizeScannableEntityType(value: string): ScannableEntityType {
  const normalized = value.trim().toUpperCase();
  if (normalized === "AQUARIUM") return "TANK";
  if (["AQUARIUMITEM", "ITEM"].includes(normalized)) return "INVENTORY";
  if (scannableEntityTypes.includes(normalized as ScannableEntityType)) return normalized as ScannableEntityType;
  throw new Error("This record type does not support QR labels.");
}

export function qrScanPath(entityType: ScannableEntityType, publicCode: string) {
  return `/q/${entityType.toLowerCase()}/${publicCode}`;
}

export function canonicalEntityPath(entityType: ScannableEntityType, entityId: string) {
  if (entityType === "TANK") return `/aquariums/${entityId}`;
  if (entityType === "EQUIPMENT") return `/equipment/${entityId}`;
  if (entityType === "SPECIES") return `/species/${entityId}`;
  return `/inventory/${entityId}`;
}

export async function validateScannableEntity(collectionId: string, entityType: ScannableEntityType, entityId: string) {
  if (entityType === "TANK") {
    const entity = await prisma.aquarium.findFirstOrThrow({ where: { id: entityId, collectionId }, select: { id: true, name: true, generatedName: true } });
    return { id: entity.id, label: entity.generatedName || entity.name };
  }
  if (entityType === "SPECIES") {
    const entity = await prisma.speciesDefinition.findFirstOrThrow({ where: { id: entityId, OR: [{ collectionId }, { collectionId: null }] }, select: { id: true, commonName: true } });
    return { id: entity.id, label: entity.commonName };
  }
  const entity = await prisma.aquariumItem.findFirstOrThrow({ where: { id: entityId, collectionId, ...(entityType === "EQUIPMENT" ? { itemType: "EQUIPMENT" } : {}) }, select: { id: true, name: true } });
  return { id: entity.id, label: entity.name };
}

export async function ensureQrCode(input: { collectionId: string; entityType: string; entityId: string; label?: string | null }) {
  const entityType = normalizeScannableEntityType(input.entityType);
  const entity = await validateScannableEntity(input.collectionId, entityType, input.entityId);
  const label = input.label?.trim() || entity.label;
  const existing = await prisma.qrCode.findUnique({ where: { entityType_entityId: { entityType, entityId: input.entityId } } });
  if (existing) return existing;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const publicCode = randomBytes(9).toString("base64url");
    try {
      return await prisma.qrCode.create({ data: { collectionId: input.collectionId, entityType, entityId: input.entityId, publicCode, label, payload: appUrl(qrScanPath(entityType, publicCode)) } });
    } catch (error) {
      if (attempt === 4) throw error;
    }
  }
  throw new Error("Unable to allocate a QR code.");
}
