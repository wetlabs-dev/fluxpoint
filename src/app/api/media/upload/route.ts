import { writeFile, unlink } from "fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser, getUserCollection } from "@/lib/auth/session";
import { writeAuditLog } from "@/domains/audit/audit-log";
import { careRoles, requireCollectionRole } from "@/domains/auth/permissions";
import { ACCEPTED_MEDIA_TYPES, createImageThumbnail, detectImageType, ensureUploadDirectory, imageDimensions, mediaDevBypassEnabled, mediaUploadMaxBytes, processMediaModeration, safeMediaFilename, uploadLocation } from "@/domains/media/media-service";

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
    const files = form.getAll("file").filter((value): value is File => value instanceof File && value.size > 0);
    const aquariumId = textValue(form, "aquariumId");
    const itemId = textValue(form, "itemId") || null;
    const conditionId = textValue(form, "conditionId") || null;
    let aquariumEventId = textValue(form, "aquariumEventId") || null;
    const caption = textValue(form, "caption").slice(0, 500) || null;
    const description = textValue(form, "description").slice(0, 2000) || null;
    const photographer = textValue(form, "photographer").slice(0, 200) || null;
    const captureDateValue = textValue(form, "captureDate");
    const captureDate = captureDateValue ? new Date(captureDateValue) : null;
    const tags = textValue(form, "tags").split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 24);
    const speciesIds = [...new Set(form.getAll("speciesDefinitionId").map(String).filter(Boolean))].slice(0, 20);
    const createPhotoEventValues = form.getAll("createPhotoEvent").map((value) => String(value));
    const createPhotoEvent = createPhotoEventValues.includes("true") || !createPhotoEventValues.includes("false");

    if (!files.length) return NextResponse.json({ error: "Choose one or more photos to upload." }, { status: 400 });
    if (!aquariumId) return NextResponse.json({ error: "An aquarium is required." }, { status: 400 });
    for (const file of files) {
      if (file.size > mediaUploadMaxBytes()) return NextResponse.json({ error: `${file.name || "Photo"} exceeds the ${Math.round(mediaUploadMaxBytes() / 1024 / 1024)} MB limit.` }, { status: 413 });
      if (!ACCEPTED_MEDIA_TYPES.includes(file.type as typeof ACCEPTED_MEDIA_TYPES[number])) return NextResponse.json({ error: "Use JPEG, PNG, or WebP photos. HEIC is not accepted yet." }, { status: 415 });
    }

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
    if (conditionId) {
      const condition = await prisma.healthCondition.findFirst({ where: { id: conditionId, collectionId: collection.id, aquariumId }, select: { id: true } });
      if (!condition) return NextResponse.json({ error: "The selected condition is not attached to this aquarium." }, { status: 400 });
    }
    const species = speciesIds.length ? await prisma.speciesDefinition.findMany({ where: { id: { in: speciesIds }, OR: [{ collectionId: collection.id }, { collectionId: null }] }, select: { id: true } }) : [];
    if (species.length !== speciesIds.length) return NextResponse.json({ error: "One or more selected species could not be linked." }, { status: 400 });

    const createdIds: string[] = [];
    try {
      if (createPhotoEvent && !aquariumEventId) {
        const event = await prisma.aquariumEvent.create({
          data: { collectionId: collection.id, aquariumId, eventType: "PHOTO", title: caption || (files.length > 1 ? `${files.length} aquarium photos` : "Aquarium photo"), summary: caption, createdById: user.id }
        });
        aquariumEventId = event.id;
      }

      for (const file of files) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const detectedType = detectImageType(buffer);
        if (!detectedType || detectedType !== file.type) return NextResponse.json({ error: `${file.name || "Photo"} contents do not match the selected image format.` }, { status: 415 });
        const filename = safeMediaFilename(detectedType);
        const destination = uploadLocation(aquariumId, filename);
        const dimensions = imageDimensions(buffer, detectedType);
        await ensureUploadDirectory(destination.directory);
        await writeFile(destination.absolutePath, buffer, { flag: "wx" });
        const thumbnailUrl = await createImageThumbnail({ buffer, aquariumId, sourceFilename: filename }).catch((error) => {
          console.warn("Unable to create media thumbnail", { aquariumId, filename, error });
          return null;
        });

        const asset = await prisma.mediaAsset.create({
          data: {
            collectionId: collection.id,
            aquariumId,
            itemId,
            aquariumEventId,
            conditionId,
            uploadedById: user.id,
            filename,
            originalFilename: file.name.slice(0, 255) || filename,
            mimeType: detectedType,
            sizeBytes: buffer.length,
            width: dimensions.width,
            height: dimensions.height,
            url: destination.url,
            thumbnailUrl,
            caption,
            description,
            photographer,
            captureDate: captureDate && !Number.isNaN(captureDate.getTime()) ? captureDate : null,
            tags: tags.length ? tags : undefined,
            speciesLinks: { create: speciesIds.map((speciesDefinitionId) => ({ collectionId: collection.id, speciesDefinitionId })) }
          }
        });
        createdIds.push(asset.id);
        if (conditionId) await prisma.healthConditionLink.create({ data: { collectionId: collection.id, conditionId, linkedEntityType: "MEDIA_ASSET", linkedEntityId: asset.id, relationship: "PHOTO" } });
        await prisma.moderationReview.create({
          data: { collectionId: collection.id, userId: user.id, entityType: "MediaAsset", entityId: asset.id, provider: "queued", model: process.env.OPENAI_MODERATION_MODEL || "omni-moderation-latest", inputType: "IMAGE", status: "PENDING", notes: "Awaiting image moderation worker." }
        });
        await writeAuditLog({ collectionId: collection.id, entityType: "MediaAsset", entityId: asset.id, action: itemId || aquariumEventId || conditionId || speciesIds.length ? "PHOTO_UPLOADED_AND_ATTACHED" : "PHOTO_UPLOADED", after: { aquariumId, itemId, aquariumEventId, conditionId, speciesIds, url: destination.url }, createdById: user.id });
        if (mediaDevBypassEnabled()) await processMediaModeration(asset.id);
      }
      const plural = createdIds.length === 1 ? "Photo" : `${createdIds.length} photos`;
      return NextResponse.json({ ids: createdIds, id: createdIds[0], status: mediaDevBypassEnabled() ? "APPROVED" : "PENDING", message: mediaDevBypassEnabled() ? `${plural} uploaded.` : `${plural} uploaded and queued for review.` }, { status: 201 });
    } catch (error) {
      for (const id of createdIds) {
        const asset = await prisma.mediaAsset.findUnique({ where: { id } });
        if (asset) {
          await unlink(uploadLocation(aquariumId, asset.filename).absolutePath).catch(() => undefined);
          if (asset.thumbnailUrl) await unlink(uploadLocation(aquariumId, asset.thumbnailUrl.split("/").pop() || "").absolutePath).catch(() => undefined);
        }
      }
      throw error;
    }
  } catch (error) {
    console.error("Media upload failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Photo upload failed." }, { status: 500 });
  }
}
