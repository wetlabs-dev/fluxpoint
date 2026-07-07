import { randomUUID } from "crypto";
import { mkdir, readFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/domains/audit/audit-log";

export const ACCEPTED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const DEFAULT_MEDIA_MAX_BYTES = 12 * 1024 * 1024;
export const MAX_MODERATION_ATTEMPTS = 3;

export function mediaUploadMaxBytes() {
  const configured = Number(process.env.MEDIA_UPLOAD_MAX_BYTES);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MEDIA_MAX_BYTES;
}

export function mediaModerationEnabled() {
  const explicit = process.env.FLUXPOINT_IMAGE_MODERATION_ENABLED ?? process.env.IMAGE_MODERATION_ENABLED;
  return explicit !== "false";
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

export async function createImageThumbnail(input: { buffer: Buffer; aquariumId: string; sourceFilename: string }) {
  const extension = "webp";
  const stem = input.sourceFilename.replace(/\.[^.]+$/, "");
  const filename = `${stem}-thumb.${extension}`;
  const destination = uploadLocation(input.aquariumId, filename);
  await ensureUploadDirectory(destination.directory);
  await sharp(input.buffer)
    .rotate()
    .resize({ width: 720, height: 720, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 78 })
    .toFile(destination.absolutePath);
  return destination.url;
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

function imageModerationModel() {
  return process.env.OPENAI_IMAGE_MODERATION_MODEL || process.env.OPENAI_MODERATION_MODEL || "omni-moderation-latest";
}

function aquariumImageCheckModel() {
  return process.env.OPENAI_AQUARIUM_IMAGE_CHECK_MODEL || process.env.OPENAI_DEFAULT_RESPONSES_MODEL || process.env.OPENAI_DEFAULT_CHAT_MODEL || "gpt-4.1-mini";
}

function requireOpenAiImageModeration() {
  if ((process.env.IMAGE_MODERATION_PROVIDER || "openai").toLowerCase() !== "openai") throw new Error("Only OpenAI image moderation is currently supported.");
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required for asynchronous image moderation.");
}

async function openAiJson(url: string, body: unknown) {
  requireOpenAiImageModeration();
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message || `OpenAI request failed with ${response.status}`);
  return payload;
}

function extractOutputText(payload: any) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  const parts = payload?.output?.flatMap((item: any) => item.content ?? []) ?? [];
  const text = parts.map((part: any) => part.text || part.output_text || "").filter(Boolean).join("\n");
  return text || payload?.choices?.[0]?.message?.content || "";
}

function parseJsonObject(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function normalizedDecision(value: unknown): "yes" | "no" | "uncertain" {
  const text = String(value || "").trim().toLowerCase();
  if (["yes", "true", "aquarium", "aquarium_content"].includes(text)) return "yes";
  if (["no", "false", "not_aquarium", "no_aquarium_content"].includes(text)) return "no";
  return "uncertain";
}

function clampConfidence(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.min(1, Math.max(0, number));
}

function safeCaption(value: unknown) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.split(" ").slice(0, 9).join(" ").slice(0, 80);
}

async function runSafetyModeration(dataUrl: string) {
  const model = imageModerationModel();
  const payload = await openAiJson("https://api.openai.com/v1/moderations", {
    model,
    input: [
      { type: "text", text: "Classify this uploaded aquarium-related image for unsafe, sexual, graphic, hateful, harassing, violent, self-harm, or illicit content." },
      { type: "image_url", image_url: { url: dataUrl } }
    ]
  });
  const result = payload?.results?.[0];
  if (!result || typeof result.flagged !== "boolean") throw new Error("OpenAI moderation returned an unreadable result.");
  const flagged = Boolean(result.flagged);
  return {
    model,
    flagged,
    blocked: flagged,
    reason: flagged ? "OpenAI image moderation flagged this upload as unsafe." : "OpenAI image moderation approved this upload.",
    categories: result.categories,
    scores: result.category_scores,
    raw: payload
  };
}

async function runAquariumContentCheck(dataUrl: string) {
  const model = aquariumImageCheckModel();
  const prompt = [
    "You are Fluxpoint's aquarium photo relevance reviewer.",
    "Decide whether the image contains aquarium-related content: aquariums, fish, invertebrates, corals, aquatic plants, hardscape, aquarium equipment, maintenance, water tests, medication, livestock bags, or aquarium rooms/workspaces.",
    "Reject unrelated selfies, pets outside aquarium context, food, documents, memes, screenshots, and generic objects.",
    "Return strict JSON only with keys: decision (yes|no|uncertain), confidence (0..1), reason, suggestedCaption.",
    "Use uncertain when the image is ambiguous, too dark, too cropped, or aquarium content is not clearly visible."
  ].join("\n");
  const payload = await openAiJson("https://api.openai.com/v1/responses", {
    model,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          { type: "input_image", image_url: dataUrl }
        ]
      }
    ],
    temperature: 0.1
  });
  const parsed = parseJsonObject(extractOutputText(payload)) ?? {};
  const decision = normalizedDecision(parsed.decision);
  return {
    model,
    decision,
    confidence: clampConfidence(parsed.confidence),
    reason: String(parsed.reason || "Aquarium relevance check completed.").slice(0, 500),
    suggestedCaption: safeCaption(parsed.suggestedCaption),
    raw: payload,
    parsed
  };
}

async function upsertImageReview(input: { photoId: string; collectionId: string; uploaderUserId?: string | null; reviewType: "NSFW" | "NO_AQUARIUM_CONTENT" | "UNCERTAIN_AQUARIUM_CONTENT"; reason?: string | null; model?: string | null }) {
  const existing = await prisma.imageModerationReview.findFirst({
    where: { photoId: input.photoId, reviewType: input.reviewType, status: "PENDING" }
  });
  if (existing) {
    return prisma.imageModerationReview.update({
      where: { id: existing.id },
      data: { reason: input.reason ?? null, model: input.model ?? null }
    });
  }
  return prisma.imageModerationReview.create({
    data: {
      photoId: input.photoId,
      collectionId: input.collectionId,
      uploaderUserId: input.uploaderUserId ?? null,
      reviewType: input.reviewType,
      reason: input.reason ?? null,
      model: input.model ?? null
    }
  });
}

export function isUnsafeMediaStatus(status: string) {
  return ["CENSORED", "REMOVED", "REJECTED", "FLAGGED"].includes(status);
}

export async function processMediaModeration(mediaAssetId: string) {
  const asset = await prisma.mediaAsset.findUnique({ where: { id: mediaAssetId } });
  if (!asset || asset.moderationStatus !== "PENDING" || asset.moderationFailureCount >= MAX_MODERATION_ATTEMPTS) return false;
  if (!mediaModerationEnabled()) return false;

  if (mediaDevBypassEnabled()) {
    await prisma.$transaction([
      prisma.mediaAsset.update({ where: { id: asset.id }, data: { moderationStatus: "APPROVED", moderationReason: "Explicit local development bypass.", moderationModel: "development-bypass", moderationCheckedAt: new Date(), moderationAttempts: { increment: 1 }, moderationFailureCount: 0, moderationLastError: null, nsfwFlagged: false, aquariumContentDetected: true, aquariumContentConfidence: 1, moderationResultJson: { provider: "development-bypass" }, aquariumAnalysisJson: { decision: "yes", confidence: 1 } } }),
      prisma.moderationReview.updateMany({ where: { entityType: "MediaAsset", entityId: asset.id, status: "PENDING" }, data: { status: "ALLOWED", provider: "development-bypass", notes: "Explicit local development bypass." } })
    ]);
    await writeAuditLog({ collectionId: asset.collectionId, entityType: "MediaAsset", entityId: asset.id, action: "PHOTO_APPROVED", after: { reason: "development-bypass" }, createdById: asset.uploadedById });
    return true;
  }

  try {
    const image = await readFile(localMediaPath(asset.url));
    const dataUrl = `data:${asset.mimeType};base64,${image.toString("base64")}`;
    const safety = await runSafetyModeration(dataUrl);
    if (safety.blocked || safety.flagged) {
      const review = await upsertImageReview({ photoId: asset.id, collectionId: asset.collectionId, uploaderUserId: asset.uploadedById, reviewType: "NSFW", reason: safety.reason, model: safety.model });
      await prisma.$transaction([
        prisma.mediaAsset.update({ where: { id: asset.id }, data: { moderationStatus: "CENSORED", moderationReason: safety.reason, moderationModel: safety.model, moderationCheckedAt: new Date(), moderationAttempts: { increment: 1 }, moderationFailureCount: 0, moderationLastError: null, nsfwFlagged: true, hiddenAt: new Date(), moderationResultJson: { categories: safety.categories, scores: safety.scores, reason: safety.reason } } }),
        prisma.aquarium.updateMany({ where: { coverMediaAssetId: asset.id }, data: { coverMediaAssetId: null, coverImageUrl: null } }),
        prisma.moderationReview.updateMany({ where: { entityType: "MediaAsset", entityId: asset.id, status: "PENDING" }, data: { status: "BLOCKED", provider: "openai", model: safety.model, notes: safety.reason, categories: safety.categories ?? undefined, scores: safety.scores ?? undefined } })
      ]);
      await writeAuditLog({ collectionId: asset.collectionId, entityType: "ImageModerationReview", entityId: review.id, action: "PHOTO_CENSORED", summary: `Photo upload requires server-admin safety review.`, after: { mediaAssetId: asset.id, status: "CENSORED", reason: safety.reason }, createdById: asset.uploadedById, severity: "CRITICAL" });
      return true;
    }

    const aquarium = await runAquariumContentCheck(dataUrl);
    const status = aquarium.decision === "yes" ? "APPROVED" : aquarium.decision === "no" ? "NO_AQUARIUM_CONTENT" : "UNCERTAIN_AQUARIUM_CONTENT";
    const reviewType = status === "NO_AQUARIUM_CONTENT" ? "NO_AQUARIUM_CONTENT" : status === "UNCERTAIN_AQUARIUM_CONTENT" ? "UNCERTAIN_AQUARIUM_CONTENT" : null;
    const review = reviewType ? await upsertImageReview({ photoId: asset.id, collectionId: asset.collectionId, uploaderUserId: asset.uploadedById, reviewType, reason: aquarium.reason, model: aquarium.model }) : null;
    await prisma.$transaction([
      prisma.mediaAsset.update({
        where: { id: asset.id },
        data: {
          moderationStatus: status,
          moderationReason: aquarium.reason,
          moderationModel: `${safety.model} + ${aquarium.model}`,
          moderationCheckedAt: new Date(),
          moderationAttempts: { increment: 1 },
          moderationFailureCount: 0,
          moderationLastError: null,
          nsfwFlagged: false,
          aquariumContentDetected: aquarium.decision === "yes" ? true : aquarium.decision === "no" ? false : null,
          aquariumContentConfidence: aquarium.confidence,
          moderationResultJson: { categories: safety.categories, scores: safety.scores, reason: safety.reason },
          aquariumAnalysisJson: { decision: aquarium.decision, confidence: aquarium.confidence, reason: aquarium.reason, suggestedCaption: aquarium.suggestedCaption, parsed: aquarium.parsed },
          ...(status === "APPROVED" && !asset.caption && aquarium.suggestedCaption ? { caption: aquarium.suggestedCaption } : {})
        }
      }),
      prisma.moderationReview.updateMany({ where: { entityType: "MediaAsset", entityId: asset.id, status: "PENDING" }, data: { status: status === "APPROVED" ? "ALLOWED" : "FLAGGED", provider: "openai", model: aquarium.model, notes: aquarium.reason } })
    ]);
    await writeAuditLog({ collectionId: asset.collectionId, entityType: review ? "ImageModerationReview" : "MediaAsset", entityId: review?.id ?? asset.id, action: status === "APPROVED" ? "PHOTO_APPROVED" : "PHOTO_NEEDS_AQUARIUM_REVIEW", after: { mediaAssetId: asset.id, status, reason: aquarium.reason, confidence: aquarium.confidence }, createdById: asset.uploadedById, severity: status === "APPROVED" ? "INFO" : "WARNING" });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const finalAttempt = asset.moderationFailureCount + 1 >= MAX_MODERATION_ATTEMPTS;
    await prisma.$transaction([
      prisma.mediaAsset.update({ where: { id: asset.id }, data: { moderationStatus: finalAttempt ? "MODERATION_FAILED" : "PENDING", moderationAttempts: { increment: 1 }, moderationFailureCount: { increment: 1 }, moderationLastError: message } }),
      ...(finalAttempt ? [prisma.moderationReview.updateMany({ where: { entityType: "MediaAsset", entityId: asset.id, status: "PENDING" }, data: { status: "ERROR", notes: message } })] : [])
    ]);
    await writeAuditLog({ collectionId: asset.collectionId, entityType: "MediaAsset", entityId: asset.id, action: "MODERATION_ERROR", summary: `Media moderation failed for ${asset.originalFilename}`, details: { error: message, finalAttempt }, createdById: asset.uploadedById, severity: "WARNING" });
    console.error("Media moderation failed", { mediaAssetId: asset.id, error: message });
    return false;
  }
}

export async function processPendingMediaModeration(limit = 10) {
  if (!mediaModerationEnabled()) return { considered: 0, processed: 0, skipped: true };
  const batchSize = Math.max(1, Math.min(Number(process.env.IMAGE_MODERATION_BATCH_SIZE || process.env.FLUXPOINT_IMAGE_MODERATION_BATCH_SIZE || limit), 50));
  const assets = await prisma.mediaAsset.findMany({ where: { moderationStatus: "PENDING", moderationFailureCount: { lt: MAX_MODERATION_ATTEMPTS } }, orderBy: { createdAt: "asc" }, take: batchSize, select: { id: true } });
  let processed = 0;
  for (const asset of assets) if (await processMediaModeration(asset.id)) processed += 1;
  return { considered: assets.length, processed, skipped: false };
}
