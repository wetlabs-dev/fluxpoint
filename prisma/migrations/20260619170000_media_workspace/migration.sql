ALTER TYPE "ModerationStatus" ADD VALUE IF NOT EXISTS 'PENDING' BEFORE 'ALLOWED';

CREATE TYPE "MediaModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'FLAGGED', 'REJECTED', 'ERROR');
CREATE TYPE "MediaVisibility" AS ENUM ('PRIVATE', 'COLLECTION', 'PUBLIC');

CREATE TABLE "MediaAsset" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "aquariumId" TEXT,
  "itemId" TEXT,
  "speciesDefinitionId" TEXT,
  "aquariumEventId" TEXT,
  "uploadedById" TEXT,
  "filename" TEXT NOT NULL,
  "originalFilename" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "url" TEXT NOT NULL,
  "thumbnailUrl" TEXT,
  "caption" TEXT,
  "altText" TEXT,
  "moderationStatus" "MediaModerationStatus" NOT NULL DEFAULT 'PENDING',
  "moderationReason" TEXT,
  "moderationModel" TEXT,
  "moderationCheckedAt" TIMESTAMP(3),
  "moderationAttempts" INTEGER NOT NULL DEFAULT 0,
  "moderationLastError" TEXT,
  "visibility" "MediaVisibility" NOT NULL DEFAULT 'COLLECTION',
  "hiddenAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Aquarium" ADD COLUMN "coverMediaAssetId" TEXT;
CREATE UNIQUE INDEX "Aquarium_coverMediaAssetId_key" ON "Aquarium"("coverMediaAssetId");
CREATE INDEX "MediaAsset_collectionId_createdAt_idx" ON "MediaAsset"("collectionId", "createdAt");
CREATE INDEX "MediaAsset_aquariumId_createdAt_idx" ON "MediaAsset"("aquariumId", "createdAt");
CREATE INDEX "MediaAsset_itemId_idx" ON "MediaAsset"("itemId");
CREATE INDEX "MediaAsset_aquariumEventId_idx" ON "MediaAsset"("aquariumEventId");
CREATE INDEX "MediaAsset_moderationStatus_moderationAttempts_createdAt_idx" ON "MediaAsset"("moderationStatus", "moderationAttempts", "createdAt");
CREATE INDEX "MediaAsset_visibility_moderationStatus_idx" ON "MediaAsset"("visibility", "moderationStatus");

ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_aquariumId_fkey" FOREIGN KEY ("aquariumId") REFERENCES "Aquarium"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "AquariumItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_speciesDefinitionId_fkey" FOREIGN KEY ("speciesDefinitionId") REFERENCES "SpeciesDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_aquariumEventId_fkey" FOREIGN KEY ("aquariumEventId") REFERENCES "AquariumEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Aquarium" ADD CONSTRAINT "Aquarium_coverMediaAssetId_fkey" FOREIGN KEY ("coverMediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
