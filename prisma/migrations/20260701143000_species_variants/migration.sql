-- CreateEnum
CREATE TYPE "SpeciesVariantType" AS ENUM ('COLOR_MORPH', 'STRAIN', 'LOCALITY', 'LINE', 'CULTIVAR', 'TRADE_NAME', 'OTHER');

-- CreateEnum
CREATE TYPE "SpeciesVariantStatus" AS ENUM ('IN_PROCESS', 'ESTABLISHED');

-- CreateTable
CREATE TABLE "SpeciesVariant" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "speciesDefinitionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT,
    "variantType" "SpeciesVariantType" NOT NULL DEFAULT 'OTHER',
    "status" "SpeciesVariantStatus" NOT NULL DEFAULT 'IN_PROCESS',
    "description" TEXT,
    "notes" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpeciesVariant_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "AquariumItem" ADD COLUMN "speciesVariantId" TEXT;

-- AlterTable
ALTER TABLE "BreedingProject" ADD COLUMN "speciesVariantId" TEXT;

-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN "speciesVariantId" TEXT;

-- AlterTable
ALTER TABLE "SpeciesTrait" ADD COLUMN "speciesVariantId" TEXT,
ADD COLUMN "desired" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "observedPercent" DOUBLE PRECISION,
ADD COLUMN "confidence" "BreedingTraitConfidence",
ADD COLUMN "notes" TEXT;

-- Existing species-level traits remain readable, but new trait records may be variant-owned.
ALTER TABLE "SpeciesTrait" DROP CONSTRAINT IF EXISTS "SpeciesTrait_speciesDefinitionId_fkey";
ALTER TABLE "SpeciesTrait" ALTER COLUMN "speciesDefinitionId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "SpeciesVariant_collectionId_speciesDefinitionId_name_key" ON "SpeciesVariant"("collectionId", "speciesDefinitionId", "name");

-- CreateIndex
CREATE INDEX "SpeciesVariant_collectionId_status_archivedAt_idx" ON "SpeciesVariant"("collectionId", "status", "archivedAt");

-- CreateIndex
CREATE INDEX "SpeciesVariant_speciesDefinitionId_archivedAt_idx" ON "SpeciesVariant"("speciesDefinitionId", "archivedAt");

-- CreateIndex
CREATE INDEX "AquariumItem_speciesVariantId_idx" ON "AquariumItem"("speciesVariantId");

-- CreateIndex
CREATE INDEX "BreedingProject_speciesVariantId_idx" ON "BreedingProject"("speciesVariantId");

-- CreateIndex
CREATE INDEX "MediaAsset_speciesVariantId_createdAt_idx" ON "MediaAsset"("speciesVariantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SpeciesTrait_collectionId_speciesVariantId_name_key" ON "SpeciesTrait"("collectionId", "speciesVariantId", "name");

-- CreateIndex
CREATE INDEX "SpeciesTrait_speciesVariantId_sortOrder_idx" ON "SpeciesTrait"("speciesVariantId", "sortOrder");

-- AddForeignKey
ALTER TABLE "SpeciesVariant" ADD CONSTRAINT "SpeciesVariant_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeciesVariant" ADD CONSTRAINT "SpeciesVariant_speciesDefinitionId_fkey" FOREIGN KEY ("speciesDefinitionId") REFERENCES "SpeciesDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AquariumItem" ADD CONSTRAINT "AquariumItem_speciesVariantId_fkey" FOREIGN KEY ("speciesVariantId") REFERENCES "SpeciesVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeciesTrait" ADD CONSTRAINT "SpeciesTrait_speciesDefinitionId_fkey" FOREIGN KEY ("speciesDefinitionId") REFERENCES "SpeciesDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeciesTrait" ADD CONSTRAINT "SpeciesTrait_speciesVariantId_fkey" FOREIGN KEY ("speciesVariantId") REFERENCES "SpeciesVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BreedingProject" ADD CONSTRAINT "BreedingProject_speciesVariantId_fkey" FOREIGN KEY ("speciesVariantId") REFERENCES "SpeciesVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_speciesVariantId_fkey" FOREIGN KEY ("speciesVariantId") REFERENCES "SpeciesVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
