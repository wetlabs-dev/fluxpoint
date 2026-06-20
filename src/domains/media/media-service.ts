import { randomUUID } from "crypto";
import { mkdir, readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db/prisma";
import { moderateImage } from "@/domains/ai/ai-service";
import { writeAuditLog } from "@/domains/audit/audit-log";

export const ACCEPTED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const DEFAULT_MEDIA_MAX_BYTES = 12 * 1024 * 1024;
export const MAX_MODERATION_ATTEMPTS = 3;

export function mediaUploadMaxBytes() {
  const configured = Number(process.env.MEDIA_UPLOAD_MAX_BYTES);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MEDIA_MAX_BYTES;
}

export function mediaModerationEnabled() {
  return process.env.IMAGE_MODERATION_ENABLED !== "false";
}

export function mediaDevBypassEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.IMAGE_MODERATION_DEV_BYPASS === "true";
}

export function safeMediaFilename(mimeType: string) {
  const extension = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  return `${Date.now()}-${randomUUID()}.${extension}`;
}

export function uploadLocation(aquariumId: string, filename: string) {
  const directory = path.join(process.cwd(), "public", "uploads", "aquariums", aquariumId);
  return { directory, absolutePath: path.join(directory, filename), url: `/uploads/aquariums/${aquariumId}/${filename}` };
}

export function localMediaPath(url: string) {
  if (!url.startsWith("/uploads/") || url.includes("..") || url.includes("\\")) throw new Error("Invalid local media URL.");
  return path.join(process.cwd(), "public", ...url.split("/").filter(Boolean));
}

export async function ensureUploadDirectory(directory: string) {
  await mkdir(directory, { recursive: true });
}

export function detectImageType(buffer: Buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

export function imageDimensions(buffer: Buffer, mimeType: string): { width: number | null; height: number | null } {
  if (mimeType === "image/png" && buffer.length >= 24) return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  if (mimeType === "image/jpeg") {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
      }
      if (length < 2) break;
      offset += 2 + length;
    }
  }
  return { width: null, height: null };
}

export async function processMediaModeration(mediaAssetId: string) {
  const asset = await prisma.mediaAsset.findUnique({ where: { id: mediaAssetId } });
  if (!asset || asset.moderationStatus !== "PENDING" || asset.moderationAttempts >= MAX_MODERATION_ATTEMPTS) return false;
  if (!mediaModerationEnabled()) return false;

  if (mediaDevBypassEnabled()) {
    await prisma.$transaction([
      prisma.mediaAsset.update({ where: { id: asset.id }, data: { moderationStatus: "APPROVED", moderationReason: "Explicit local development bypass.", moderationModel: "development-bypass", moderationCheckedAt: new Date(), moderationAttempts: { increment: 1 }, moderationLastError: null } }),
      prisma.moderationReview.updateMany({ where: { entityType: "MediaAsset", entityId: asset.id, status: "PENDING" }, data: { status: "ALLOWED", provider: "development-bypass", notes: "Explicit local development bypass." } })
    ]);
    await writeAuditLog({ entityType: "MediaAsset", entityId: asset.id, action: "PHOTO_APPROVED", after: { reason: "development-bypass" }, createdById: asset.uploadedById });
    return true;
  }

  try {
    if ((process.env.IMAGE_MODERATION_PROVIDER || "openai").toLowerCase() !== "openai" || (process.env.AI_PROVIDER || "mock").toLowerCase() !== "openai" || !process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI image moderation is not configured; media remains fail-closed.");
    }
    const image = await readFile(localMediaPath(asset.url));
    const result = await moderateImage({
      dataUrl: `data:${asset.mimeType};base64,${image.toString("base64")}`,
      filename: asset.filename,
      collectionId: asset.collectionId,
      userId: asset.uploadedById,
      entityType: "MediaAsset",
      entityId: asset.id
    });
    const status = result.blocked ? "REJECTED" : result.flagged ? "FLAGGED" : "APPROVED";
    await prisma.$transaction([
      prisma.mediaAsset.update({ where: { id: asset.id }, data: { moderationStatus: status, moderationReason: result.reason ?? null, moderationModel: process.env.OPENAI_MODERATION_MODEL || "omni-moderation-latest", moderationCheckedAt: new Date(), moderationAttempts: { increment: 1 }, moderationLastError: null } }),
      prisma.moderationReview.updateMany({ where: { entityType: "MediaAsset", entityId: asset.id, status: "PENDING" }, data: { status: result.blocked ? "BLOCKED" : result.flagged ? "FLAGGED" : "ALLOWED", notes: result.reason ?? null } })
    ]);
    await writeAuditLog({ entityType: "MediaAsset", entityId: asset.id, action: status === "APPROVED" ? "PHOTO_APPROVED" : "PHOTO_REJECTED", after: { status, reason: result.reason }, createdById: asset.uploadedById });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const finalAttempt = asset.moderationAttempts + 1 >= MAX_MODERATION_ATTEMPTS;
    await prisma.$transaction([
      prisma.mediaAsset.update({ where: { id: asset.id }, data: { moderationStatus: finalAttempt ? "ERROR" : "PENDING", moderationAttempts: { increment: 1 }, moderationLastError: message } }),
      ...(finalAttempt ? [prisma.moderationReview.updateMany({ where: { entityType: "MediaAsset", entityId: asset.id, status: "PENDING" }, data: { status: "ERROR", notes: message } })] : [])
    ]);
    console.error("Media moderation failed", { mediaAssetId: asset.id, error: message });
    return false;
  }
}

export async function processPendingMediaModeration(limit = 10) {
  if (!mediaModerationEnabled()) return { considered: 0, processed: 0, skipped: true };
  const assets = await prisma.mediaAsset.findMany({ where: { moderationStatus: "PENDING", moderationAttempts: { lt: MAX_MODERATION_ATTEMPTS } }, orderBy: { createdAt: "asc" }, take: limit, select: { id: true } });
  let processed = 0;
  for (const asset of assets) if (await processMediaModeration(asset.id)) processed += 1;
  return { considered: assets.length, processed, skipped: false };
}
