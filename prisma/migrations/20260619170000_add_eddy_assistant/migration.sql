ALTER TYPE "AiRequestType" ADD VALUE IF NOT EXISTS 'COMPATIBILITY';
ALTER TYPE "AiRequestType" ADD VALUE IF NOT EXISTS 'STOCKING';
ALTER TYPE "AiRequestType" ADD VALUE IF NOT EXISTS 'HUSBANDRY';

ALTER TABLE "AiRequestLog" ADD COLUMN "speciesDefinitionId" TEXT;

CREATE INDEX "AiRequestLog_speciesDefinitionId_createdAt_idx" ON "AiRequestLog"("speciesDefinitionId", "createdAt");

ALTER TABLE "AiRequestLog" ADD CONSTRAINT "AiRequestLog_speciesDefinitionId_fkey" FOREIGN KEY ("speciesDefinitionId") REFERENCES "SpeciesDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
