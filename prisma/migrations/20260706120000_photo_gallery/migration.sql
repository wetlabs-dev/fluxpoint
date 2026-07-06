-- CreateEnum
CREATE TYPE "MediaSource" AS ENUM ('USER_UPLOAD', 'AI_GENERATED', 'IMPORTED', 'OTHER');

-- AlterTable
ALTER TABLE "AquariumPublicProfile" ADD COLUMN "hidePhotoMetadata" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "hidePhotoUploadDates" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "showPhotoGallery" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN "captureDate" TIMESTAMP(3),
ADD COLUMN "description" TEXT,
ADD COLUMN "mediaSource" "MediaSource" NOT NULL DEFAULT 'USER_UPLOAD',
ADD COLUMN "photographer" TEXT,
ADD COLUMN "tags" JSONB;

-- CreateTable
CREATE TABLE "MediaAssetSpeciesLink" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "mediaAssetId" TEXT NOT NULL,
    "speciesDefinitionId" TEXT NOT NULL,
    "speciesVariantId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAssetSpeciesLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MediaAssetSpeciesLink_mediaAssetId_speciesDefinitionId_speciesVariantId_key" ON "MediaAssetSpeciesLink"("mediaAssetId", "speciesDefinitionId", "speciesVariantId");

-- CreateIndex
CREATE INDEX "MediaAssetSpeciesLink_collectionId_speciesDefinitionId_idx" ON "MediaAssetSpeciesLink"("collectionId", "speciesDefinitionId");

-- CreateIndex
CREATE INDEX "MediaAssetSpeciesLink_speciesVariantId_idx" ON "MediaAssetSpeciesLink"("speciesVariantId");

-- CreateIndex
CREATE INDEX "MediaAsset_mediaSource_createdAt_idx" ON "MediaAsset"("mediaSource", "createdAt");

-- AddForeignKey
ALTER TABLE "MediaAssetSpeciesLink" ADD CONSTRAINT "MediaAssetSpeciesLink_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAssetSpeciesLink" ADD CONSTRAINT "MediaAssetSpeciesLink_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAssetSpeciesLink" ADD CONSTRAINT "MediaAssetSpeciesLink_speciesDefinitionId_fkey" FOREIGN KEY ("speciesDefinitionId") REFERENCES "SpeciesDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAssetSpeciesLink" ADD CONSTRAINT "MediaAssetSpeciesLink_speciesVariantId_fkey" FOREIGN KEY ("speciesVariantId") REFERENCES "SpeciesVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
