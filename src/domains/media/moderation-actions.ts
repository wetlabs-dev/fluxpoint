"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { requireServerAdmin } from "@/domains/server/server-admin";
import { writeAuditLog } from "@/domains/audit/audit-log";
import { setFormFlash } from "@/lib/forms/form-flash";

async function pendingReview(id: string) {
  return prisma.imageModerationReview.findUniqueOrThrow({
    where: { id },
    include: { photo: true, uploaderUser: true }
  });
}

async function clearCoverReferences(photoId: string) {
  await prisma.aquarium.updateMany({ where: { coverMediaAssetId: photoId }, data: { coverMediaAssetId: null, coverImageUrl: null } });
}

function reviewId(formData: FormData) {
  const id = String(formData.get("reviewId") || "");
  if (!id) throw new Error("Review id is required.");
  return id;
}

export async function keepAquariumPhotoFromReview(formData: FormData) {
  const user = await requireUser();
  const review = await pendingReview(reviewId(formData));
  if (review.status !== "PENDING") throw new Error("This review has already been resolved.");
  if (review.reviewType === "NSFW") throw new Error("Safety reviews require a server administrator.");
  if (review.uploaderUserId !== user.id) throw new Error("You can only resolve your own photo reviews.");
  await prisma.$transaction([
    prisma.mediaAsset.update({
      where: { id: review.photoId },
      data: {
        moderationStatus: "APPROVED",
        moderationReason: "Uploader confirmed this photo is aquarium-related.",
        moderationCheckedAt: new Date(),
        aquariumContentDetected: true,
        nsfwFlagged: false,
        hiddenAt: null
      }
    }),
    prisma.imageModerationReview.update({
      where: { id: review.id },
      data: { status: "USER_CONFIRMED", resolvedAt: new Date(), resolvedByUserId: user.id, resolutionNotes: "Uploader confirmed aquarium relevance." }
    })
  ]);
  await writeAuditLog({ collectionId: review.collectionId, entityType: "ImageModerationReview", entityId: review.id, action: "PHOTO_REVIEW_USER_CONFIRMED", summary: "Uploader confirmed an aquarium-relevance review.", after: { mediaAssetId: review.photoId }, createdById: user.id });
  revalidatePath("/account");
  revalidatePath("/aquariums");
  await setFormFlash("Photo approved for your Fluxpoint gallery.");
}

export async function removePhotoFromReview(formData: FormData) {
  const user = await requireUser();
  const review = await pendingReview(reviewId(formData));
  if (review.status !== "PENDING") throw new Error("This review has already been resolved.");
  if (review.uploaderUserId !== user.id && user.serverRole !== "SERVER_ADMIN") throw new Error("You can only remove your own reviewed photos.");
  await clearCoverReferences(review.photoId);
  await prisma.$transaction([
    prisma.mediaAsset.update({
      where: { id: review.photoId },
      data: { moderationStatus: "REMOVED", moderationReason: "Removed during image moderation review.", hiddenAt: new Date() }
    }),
    prisma.imageModerationReview.update({
      where: { id: review.id },
      data: { status: "REMOVED", resolvedAt: new Date(), resolvedByUserId: user.id, resolutionNotes: "Photo removed during moderation review." }
    })
  ]);
  await writeAuditLog({ collectionId: review.collectionId, entityType: "ImageModerationReview", entityId: review.id, action: "PHOTO_REVIEW_REMOVED", summary: "Photo removed during moderation review.", after: { mediaAssetId: review.photoId }, createdById: user.id, severity: review.reviewType === "NSFW" ? "WARNING" : "INFO" });
  revalidatePath("/account");
  revalidatePath("/server-maintenance");
  revalidatePath("/aquariums");
  await setFormFlash("Photo removed.");
}

export async function overrideSafetyReview(formData: FormData) {
  const user = await requireUser();
  await requireServerAdmin(user);
  const review = await pendingReview(reviewId(formData));
  if (review.status !== "PENDING") throw new Error("This review has already been resolved.");
  if (review.reviewType !== "NSFW") throw new Error("Only safety reviews can be overridden here.");
  await prisma.$transaction([
    prisma.mediaAsset.update({
      where: { id: review.photoId },
      data: { moderationStatus: "APPROVED", moderationReason: "Server admin marked safety flag as a false positive.", nsfwFlagged: false, hiddenAt: null, moderationCheckedAt: new Date() }
    }),
    prisma.imageModerationReview.update({
      where: { id: review.id },
      data: { status: "OVERRIDDEN_FALSE_ALARM", resolvedAt: new Date(), resolvedByUserId: user.id, resolutionNotes: "Server admin marked this safety flag as a false positive." }
    })
  ]);
  await writeAuditLog({ collectionId: review.collectionId, entityType: "ImageModerationReview", entityId: review.id, action: "PHOTO_SAFETY_REVIEW_OVERRIDDEN", summary: "Server admin approved a safety-flagged image as a false positive.", after: { mediaAssetId: review.photoId }, createdById: user.id, severity: "WARNING" });
  revalidatePath("/server-maintenance");
  await setFormFlash("Safety review overridden and photo approved.");
}

export async function removeSafetyReviewedPhoto(formData: FormData) {
  const user = await requireUser();
  await requireServerAdmin(user);
  const review = await pendingReview(reviewId(formData));
  if (review.status !== "PENDING") throw new Error("This review has already been resolved.");
  const disableUploader = formData.get("disableUploader") === "on" && review.uploaderUserId && review.uploaderUserId !== user.id;
  await clearCoverReferences(review.photoId);
  await prisma.$transaction([
    prisma.mediaAsset.update({
      where: { id: review.photoId },
      data: { moderationStatus: "REMOVED", moderationReason: "Removed by server admin after safety moderation review.", nsfwFlagged: true, hiddenAt: new Date() }
    }),
    prisma.imageModerationReview.update({
      where: { id: review.id },
      data: { status: "REMOVED", resolvedAt: new Date(), resolvedByUserId: user.id, resolutionNotes: disableUploader ? "Photo removed and uploader account disabled." : "Photo removed by server admin." }
    }),
    ...(disableUploader ? [prisma.user.update({ where: { id: review.uploaderUserId! }, data: { disabledAt: new Date() } }), prisma.session.deleteMany({ where: { userId: review.uploaderUserId! } })] : [])
  ]);
  await writeAuditLog({ collectionId: review.collectionId, entityType: "ImageModerationReview", entityId: review.id, action: disableUploader ? "PHOTO_REMOVED_USER_DISABLED" : "PHOTO_SAFETY_REVIEW_REMOVED", summary: disableUploader ? "Server admin removed a safety-flagged photo and disabled the uploader." : "Server admin removed a safety-flagged photo.", after: { mediaAssetId: review.photoId, uploaderUserId: review.uploaderUserId, disableUploader }, createdById: user.id, severity: "CRITICAL" });
  revalidatePath("/server-maintenance");
  await setFormFlash(disableUploader ? "Photo removed and uploader disabled." : "Photo removed.");
}
