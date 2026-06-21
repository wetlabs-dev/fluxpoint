CREATE TYPE "RegionalSpeciesStatus" AS ENUM ('UNKNOWN', 'NOT_LISTED', 'WATCHLIST', 'ESTABLISHED_NON_NATIVE', 'INVASIVE', 'RESTRICTED', 'PROHIBITED');
CREATE TYPE "RegionalStatusConfidence" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

ALTER TABLE "Collection"
  ADD COLUMN "localityCity" TEXT,
  ADD COLUMN "localityRegion" TEXT,
  ADD COLUMN "localityCountry" TEXT,
  ADD COLUMN "localityPostalCode" TEXT,
  ADD COLUMN "localityLabel" TEXT,
  ADD COLUMN "localityNotes" TEXT;

CREATE TABLE "SpeciesRegionalStatus" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "speciesDefinitionId" TEXT NOT NULL,
  "localityCitySnapshot" TEXT,
  "localityRegionSnapshot" TEXT,
  "localityCountrySnapshot" TEXT,
  "localityPostalCodeSnapshot" TEXT,
  "localityLabelSnapshot" TEXT,
  "status" "RegionalSpeciesStatus" NOT NULL DEFAULT 'UNKNOWN',
  "statusScope" TEXT,
  "sourceName" TEXT,
  "sourceUrl" TEXT,
  "notes" TEXT,
  "confidence" "RegionalStatusConfidence",
  "checkedAt" TIMESTAMP(3),
  "checkedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SpeciesRegionalStatus_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SpeciesRegionalStatus_collectionId_speciesDefinitionId_key" ON "SpeciesRegionalStatus"("collectionId", "speciesDefinitionId");
CREATE INDEX "SpeciesRegionalStatus_collectionId_status_idx" ON "SpeciesRegionalStatus"("collectionId", "status");
CREATE INDEX "SpeciesRegionalStatus_speciesDefinitionId_idx" ON "SpeciesRegionalStatus"("speciesDefinitionId");
ALTER TABLE "SpeciesRegionalStatus" ADD CONSTRAINT "SpeciesRegionalStatus_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SpeciesRegionalStatus" ADD CONSTRAINT "SpeciesRegionalStatus_speciesDefinitionId_fkey" FOREIGN KEY ("speciesDefinitionId") REFERENCES "SpeciesDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SpeciesRegionalStatus" ADD CONSTRAINT "SpeciesRegionalStatus_checkedByUserId_fkey" FOREIGN KEY ("checkedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
