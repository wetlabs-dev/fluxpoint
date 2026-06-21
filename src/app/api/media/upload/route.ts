import { writeFile, unlink } from "fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser, getUserCollection } from "@/lib/auth/session";
import { writeAuditLog } from "@/domains/audit/audit-log";
import { careRoles, requireCollectionRole } from "@/domains/auth/permissions";
import { ACCEPTED_MEDIA_TYPES, detectImageType, ensureUploadDirectory, imageDimensions, mediaDevBypassEnabled, mediaUploadMaxBytes, processMediaModeration, safeMediaFilename, uploadLocation } from "@/domains/media/media-service";

export const runtime = "nodejs";

function textValue(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to upload photos." }, { status: 401 });
  const collection = await getUserCollection(user.id);
  await requireCollectionRole(collection.id, careRoles);

  try {
    const form = await request.formData();
    const file = form.get("file");
    const aquariumId = textValue(form, "aquariumId");
    const itemId = textValue(form, "itemId") || null;
    let aquariumEventId = textValue(form, "aquariumEventId") || null;
    const caption = textValue(form, "caption").slice(0, 500) || null;
    const createPhotoEvent = textValue(form, "createPhotoEvent") === "true";

    if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "Choose a photo to upload." }, { status: 400 });
    if (!aquariumId) return NextResponse.json({ error: "An aquarium is required." }, { status: 400 });
    if (file.size > mediaUploadMaxBytes()) return NextResponse.json({ error: `Photo exceeds the ${Math.round(mediaUploadMaxBytes() / 1024 / 1024)} MB limit.` }, { status: 413 });
    if (!ACCEPTED_MEDIA_TYPES.includes(file.type as typeof ACCEPTED_MEDIA_TYPES[number])) return NextResponse.json({ error: "Use a JPEG, PNG, or WebP photo. HEIC is not accepted yet." }, { status: 415 });

    const aquarium = await prisma.aquarium.findFirst({ where: { id: aquariumId, collectionId: collection.id }, select: { id: true } });
    if (!aquarium) return NextResponse.json({ error: "Aquarium not found." }, { status: 404 });
    if (itemId) {
      const item = await prisma.aquariumItem.findFirst({ where: { id: itemId, collectionId: collection.id, aquariumId }, select: { id: true } });
      if (!item) return NextResponse.json({ error: "The selected item is not in this aquarium." }, { status: 400 });
    }
    if (aquariumEventId) {
      const event = await prisma.aquariumEvent.findFirst({ where: { id: aquariumEventId, collectionId: collection.id, aquariumId }, select: { id: true } });
      if (!event) return NextResponse.json({ error: "The selected timeline event is not in this aquarium." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const detectedType = detectImageType(buffer);
    if (!detectedType || detectedType !== file.type) return NextResponse.json({ error: "The file contents do not match the selected image format." }, { status: 415 });
    const filename = safeMediaFilename(detectedType);
    const destination = uploadLocation(aquariumId, filename);
    const dimensions = imageDimensions(buffer, detectedType);
    await ensureUploadDirectory(destination.directory);
    await writeFile(destination.absolutePath, buffer, { flag: "wx" });

    try {
      if (createPhotoEvent && !aquariumEventId) {
        const event = await prisma.aquariumEvent.create({
          data: { collectionId: collection.id, aquariumId, eventType: "PHOTO", title: caption || "Aquarium photo", summary: caption, createdById: user.id }
        });
        aquariumEventId = event.id;
      }

      const asset = await prisma.mediaAsset.create({
        data: {
          collectionId: collection.id,
          aquariumId,
          itemId,
          aquariumEventId,
          uploadedById: user.id,
          filename,
          originalFilename: file.name.slice(0, 255) || filename,
          mimeType: detectedType,
          sizeBytes: buffer.length,
          width: dimensions.width,
          height: dimensions.height,
          url: destination.url,
          caption
        }
      });
      await prisma.moderationReview.create({
        data: { collectionId: collection.id, userId: user.id, entityType: "MediaAsset", entityId: asset.id, provider: "queued", model: process.env.OPENAI_MODERATION_MODEL || "omni-moderation-latest", inputType: "IMAGE", status: "PENDING", notes: "Awaiting image moderation worker." }
      });
      await writeAuditLog({ entityType: "MediaAsset", entityId: asset.id, action: itemId || aquariumEventId ? "PHOTO_UPLOADED_AND_ATTACHED" : "PHOTO_UPLOADED", after: { aquariumId, itemId, aquariumEventId, url: destination.url }, createdById: user.id });
      if (mediaDevBypassEnabled()) await processMediaModeration(asset.id);
      return NextResponse.json({ id: asset.id, status: mediaDevBypassEnabled() ? "APPROVED" : "PENDING", message: mediaDevBypassEnabled() ? "Photo uploaded." : "Photo uploaded and queued for review." }, { status: 201 });
    } catch (error) {
      await unlink(destination.absolutePath).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    console.error("Media upload failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Photo upload failed." }, { status: 500 });
  }
}
