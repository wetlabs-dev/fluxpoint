ALTER TYPE "MediaModerationStatus" ADD VALUE IF NOT EXISTS 'CENSORED';
ALTER TYPE "MediaModerationStatus" ADD VALUE IF NOT EXISTS 'NO_AQUARIUM_CONTENT';
ALTER TYPE "MediaModerationStatus" ADD VALUE IF NOT EXISTS 'UNCERTAIN_AQUARIUM_CONTENT';
ALTER TYPE "MediaModerationStatus" ADD VALUE IF NOT EXISTS 'MODERATION_FAILED';
ALTER TYPE "MediaModerationStatus" ADD VALUE IF NOT EXISTS 'REMOVED';

DO $$ BEGIN
  CREATE TYPE "ImageModerationReviewType" AS ENUM ('NSFW', 'NO_AQUARIUM_CONTENT', 'UNCERTAIN_AQUARIUM_CONTENT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ImageModerationReviewStatus" AS ENUM ('PENDING', 'OVERRIDDEN_FALSE_ALARM', 'USER_CONFIRMED', 'REMOVED', 'DISMISSED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "MediaAsset"
  ADD COLUMN IF NOT EXISTS "nsfwFlagged" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "aquariumContentDetected" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "aquariumContentConfidence" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "moderationResultJson" JSONB,
  ADD COLUMN IF NOT EXISTS "aquariumAnalysisJson" JSONB,
  ADD COLUMN IF NOT EXISTS "moderationFailureCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "ImageModerationReview" (
  "id" TEXT NOT NULL,
  "photoId" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "uploaderUserId" TEXT,
  "reviewType" "ImageModerationReviewType" NOT NULL,
  "status" "ImageModerationReviewStatus" NOT NULL DEFAULT 'PENDING',
  "reason" TEXT,
  "model" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "resolvedByUserId" TEXT,
  "resolutionNotes" TEXT,

  CONSTRAINT "ImageModerationReview_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ImageModerationReview_collectionId_status_createdAt_idx" ON "ImageModerationReview"("collectionId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "ImageModerationReview_uploaderUserId_status_createdAt_idx" ON "ImageModerationReview"("uploaderUserId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "ImageModerationReview_photoId_reviewType_status_idx" ON "ImageModerationReview"("photoId", "reviewType", "status");

DO $$ BEGIN
  ALTER TABLE "ImageModerationReview" ADD CONSTRAINT "ImageModerationReview_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ImageModerationReview" ADD CONSTRAINT "ImageModerationReview_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ImageModerationReview" ADD CONSTRAINT "ImageModerationReview_uploaderUserId_fkey" FOREIGN KEY ("uploaderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ImageModerationReview" ADD CONSTRAINT "ImageModerationReview_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
