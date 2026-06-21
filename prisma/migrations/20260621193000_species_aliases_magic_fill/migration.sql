CREATE TYPE "SpeciesAliasType" AS ENUM ('COMMON_NAME', 'TRADE_NAME', 'OLD_NAME', 'MISSPELLING', 'SCIENTIFIC_SYNONYM', 'LOCAL_NAME', 'OTHER');

CREATE TABLE "SpeciesAlias" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "speciesDefinitionId" TEXT NOT NULL,
  "alias" TEXT NOT NULL,
  "normalizedAlias" TEXT NOT NULL,
  "aliasType" "SpeciesAliasType" NOT NULL DEFAULT 'OTHER',
  "notes" TEXT,
  "source" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SpeciesAlias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SpeciesAlias_collectionId_speciesDefinitionId_normalizedAlias_key" ON "SpeciesAlias"("collectionId", "speciesDefinitionId", "normalizedAlias");
CREATE INDEX "SpeciesAlias_collectionId_normalizedAlias_idx" ON "SpeciesAlias"("collectionId", "normalizedAlias");
CREATE INDEX "SpeciesAlias_speciesDefinitionId_aliasType_idx" ON "SpeciesAlias"("speciesDefinitionId", "aliasType");

ALTER TABLE "SpeciesAlias" ADD CONSTRAINT "SpeciesAlias_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SpeciesAlias" ADD CONSTRAINT "SpeciesAlias_speciesDefinitionId_fkey" FOREIGN KEY ("speciesDefinitionId") REFERENCES "SpeciesDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
