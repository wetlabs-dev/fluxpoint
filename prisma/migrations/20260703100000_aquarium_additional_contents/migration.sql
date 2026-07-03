-- CreateEnum
CREATE TYPE "AquariumAdditionalContentCategory" AS ENUM ('PLANT', 'FISH', 'INVERTEBRATE', 'CORAL', 'HARDSCAPE', 'EQUIPMENT', 'SUBSTRATE', 'BOTANICAL', 'UNKNOWN', 'NOTE', 'OTHER');

-- CreateEnum
CREATE TYPE "AquariumAdditionalContentConfidence" AS ENUM ('UNKNOWN', 'ROUGH', 'CONFIDENT');

-- CreateEnum
CREATE TYPE "AquariumAdditionalContentIntent" AS ENUM ('INFORMATIONAL', 'NEEDS_STRUCTURED_RECORD', 'INTENTIONALLY_UNSTRUCTURED');

-- AlterTable
ALTER TABLE "Aquarium" ADD COLUMN "unstructuredContentsNotes" TEXT;

-- CreateTable
CREATE TABLE "AquariumAdditionalContent" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "aquariumId" TEXT NOT NULL,
    "category" "AquariumAdditionalContentCategory" NOT NULL DEFAULT 'UNKNOWN',
    "description" TEXT NOT NULL,
    "approximateQuantity" TEXT,
    "confidence" "AquariumAdditionalContentConfidence" NOT NULL DEFAULT 'UNKNOWN',
    "intent" "AquariumAdditionalContentIntent" NOT NULL DEFAULT 'INFORMATIONAL',
    "includeInEddyContext" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AquariumAdditionalContent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AquariumAdditionalContent_collectionId_aquariumId_archivedAt_idx" ON "AquariumAdditionalContent"("collectionId", "aquariumId", "archivedAt");

-- CreateIndex
CREATE INDEX "AquariumAdditionalContent_collectionId_intent_archivedAt_idx" ON "AquariumAdditionalContent"("collectionId", "intent", "archivedAt");

-- CreateIndex
CREATE INDEX "AquariumAdditionalContent_aquariumId_category_idx" ON "AquariumAdditionalContent"("aquariumId", "category");

-- AddForeignKey
ALTER TABLE "AquariumAdditionalContent" ADD CONSTRAINT "AquariumAdditionalContent_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AquariumAdditionalContent" ADD CONSTRAINT "AquariumAdditionalContent_aquariumId_fkey" FOREIGN KEY ("aquariumId") REFERENCES "Aquarium"("id") ON DELETE CASCADE ON UPDATE CASCADE;
