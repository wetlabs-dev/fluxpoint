CREATE TYPE "SpeciesHusbandryType" AS ENUM ('FRESHWATER_FISH', 'MARINE_FISH', 'PLANT', 'INVERTEBRATE', 'CORAL', 'OTHER');
CREATE TYPE "SpeciesHusbandryGuideStatus" AS ENUM ('LOCAL', 'LINKED', 'AI_DRAFT', 'REVIEWED');

ALTER TABLE "SpeciesDefinition" ADD COLUMN "collectionId" TEXT;

CREATE TABLE "SpeciesHusbandryGuide" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "speciesDefinitionId" TEXT NOT NULL,
  "sourceSpeciesDefinitionId" TEXT,
  "status" "SpeciesHusbandryGuideStatus" NOT NULL DEFAULT 'LOCAL',
  "speciesType" "SpeciesHusbandryType" NOT NULL,
  "summary" TEXT,
  "careDifficulty" TEXT,
  "sourceNotes" TEXT,
  "aiGeneratedAt" TIMESTAMP(3),
  "aiReviewedAt" TIMESTAMP(3),
  "fields" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SpeciesHusbandryGuide_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SpeciesHusbandryOverride" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "aquariumItemId" TEXT NOT NULL,
  "speciesDefinitionId" TEXT NOT NULL,
  "overrideNotes" TEXT,
  "fields" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SpeciesHusbandryOverride_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SpeciesDefinition_collectionId_category_idx" ON "SpeciesDefinition"("collectionId", "category");
CREATE UNIQUE INDEX "SpeciesHusbandryGuide_speciesDefinitionId_key" ON "SpeciesHusbandryGuide"("speciesDefinitionId");
CREATE INDEX "SpeciesHusbandryGuide_collectionId_status_idx" ON "SpeciesHusbandryGuide"("collectionId", "status");
CREATE INDEX "SpeciesHusbandryGuide_sourceSpeciesDefinitionId_idx" ON "SpeciesHusbandryGuide"("sourceSpeciesDefinitionId");
CREATE UNIQUE INDEX "SpeciesHusbandryOverride_aquariumItemId_key" ON "SpeciesHusbandryOverride"("aquariumItemId");
CREATE INDEX "SpeciesHusbandryOverride_collectionId_idx" ON "SpeciesHusbandryOverride"("collectionId");
CREATE INDEX "SpeciesHusbandryOverride_speciesDefinitionId_idx" ON "SpeciesHusbandryOverride"("speciesDefinitionId");

ALTER TABLE "SpeciesDefinition" ADD CONSTRAINT "SpeciesDefinition_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SpeciesHusbandryGuide" ADD CONSTRAINT "SpeciesHusbandryGuide_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SpeciesHusbandryGuide" ADD CONSTRAINT "SpeciesHusbandryGuide_speciesDefinitionId_fkey" FOREIGN KEY ("speciesDefinitionId") REFERENCES "SpeciesDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SpeciesHusbandryGuide" ADD CONSTRAINT "SpeciesHusbandryGuide_sourceSpeciesDefinitionId_fkey" FOREIGN KEY ("sourceSpeciesDefinitionId") REFERENCES "SpeciesDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SpeciesHusbandryOverride" ADD CONSTRAINT "SpeciesHusbandryOverride_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SpeciesHusbandryOverride" ADD CONSTRAINT "SpeciesHusbandryOverride_aquariumItemId_fkey" FOREIGN KEY ("aquariumItemId") REFERENCES "AquariumItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SpeciesHusbandryOverride" ADD CONSTRAINT "SpeciesHusbandryOverride_speciesDefinitionId_fkey" FOREIGN KEY ("speciesDefinitionId") REFERENCES "SpeciesDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
