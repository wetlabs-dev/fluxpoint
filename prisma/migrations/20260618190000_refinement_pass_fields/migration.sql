ALTER TABLE "AquariumProfile" ADD COLUMN "heaterItemId" TEXT;

ALTER TABLE "SpeciesDefinition" ADD COLUMN "lifespan" TEXT;
ALTER TABLE "SpeciesDefinition" ADD COLUMN "minimumGroupSize" INTEGER;
ALTER TABLE "SpeciesDefinition" ADD COLUMN "maxHeight" DOUBLE PRECISION;
ALTER TABLE "SpeciesDefinition" ADD COLUMN "maxSpread" DOUBLE PRECISION;
ALTER TABLE "SpeciesDefinition" ADD COLUMN "growthRate" TEXT;
ALTER TABLE "SpeciesDefinition" ADD COLUMN "lightRequirement" TEXT;
ALTER TABLE "SpeciesDefinition" ADD COLUMN "co2Preference" TEXT;
ALTER TABLE "SpeciesDefinition" ADD COLUMN "preferredHardness" TEXT;
ALTER TABLE "SpeciesDefinition" ADD COLUMN "breedingNotes" TEXT;
ALTER TABLE "SpeciesDefinition" ADD COLUMN "flowRequirement" TEXT;

CREATE INDEX "AquariumProfile_heaterItemId_idx" ON "AquariumProfile"("heaterItemId");

ALTER TABLE "AquariumProfile" ADD CONSTRAINT "AquariumProfile_heaterItemId_fkey" FOREIGN KEY ("heaterItemId") REFERENCES "AquariumItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
