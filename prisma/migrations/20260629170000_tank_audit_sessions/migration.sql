CREATE TYPE "TankAuditSessionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'FINALIZED', 'CANCELLED');
CREATE TYPE "TankAuditLineStatus" AS ENUM ('PENDING', 'CONFIRMED', 'ADJUST', 'MISSING', 'REMOVE', 'FOUND_EXTRA', 'MAINTENANCE_NEEDED', 'CONDITION_NOTED', 'NO_CHANGE');
CREATE TYPE "TankAuditObservedPlacementAction" AS ENUM ('CONFIRM', 'ADJUST_QUANTITY', 'LOG_LOSS', 'REMOVE_FROM_TANK', 'DETACH_EQUIPMENT', 'CREATE_ITEM', 'NOTE_ONLY');

CREATE TABLE "TankAuditSession" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "aquariumId" TEXT NOT NULL,
  "status" "TankAuditSessionStatus" NOT NULL DEFAULT 'OPEN',
  "title" TEXT,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "openedById" TEXT,
  "finalizedAt" TIMESTAMP(3),
  "finalizedById" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "cancelledById" TEXT,
  "notes" TEXT,
  "worksheetGeneratedAt" TIMESTAMP(3),
  "worksheetFilePath" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TankAuditSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TankAuditLine" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "auditSessionId" TEXT NOT NULL,
  "aquariumItemId" TEXT,
  "itemSnapshot" JSONB NOT NULL,
  "itemType" "ItemType" NOT NULL,
  "itemName" TEXT NOT NULL,
  "speciesDefinitionId" TEXT,
  "equipmentProfileId" TEXT,
  "expectedQuantity" DOUBLE PRECISION,
  "observedQuantity" DOUBLE PRECISION,
  "expectedPlacementSnapshot" JSONB,
  "observedPlacementAction" "TankAuditObservedPlacementAction",
  "status" "TankAuditLineStatus" NOT NULL DEFAULT 'PENDING',
  "notes" TEXT,
  "healthNotes" TEXT,
  "growthNotes" TEXT,
  "maintenanceNotes" TEXT,
  "createCondition" BOOLEAN NOT NULL DEFAULT false,
  "lossCount" DOUBLE PRECISION,
  "maleCountApprox" INTEGER,
  "femaleCountApprox" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TankAuditLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TankAuditSession_collectionId_aquariumId_status_idx" ON "TankAuditSession"("collectionId", "aquariumId", "status");
CREATE INDEX "TankAuditSession_aquariumId_openedAt_idx" ON "TankAuditSession"("aquariumId", "openedAt");
CREATE INDEX "TankAuditLine_collectionId_auditSessionId_status_idx" ON "TankAuditLine"("collectionId", "auditSessionId", "status");
CREATE INDEX "TankAuditLine_aquariumItemId_idx" ON "TankAuditLine"("aquariumItemId");
CREATE INDEX "TankAuditLine_speciesDefinitionId_idx" ON "TankAuditLine"("speciesDefinitionId");
CREATE INDEX "TankAuditLine_equipmentProfileId_idx" ON "TankAuditLine"("equipmentProfileId");

ALTER TABLE "TankAuditSession" ADD CONSTRAINT "TankAuditSession_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TankAuditSession" ADD CONSTRAINT "TankAuditSession_aquariumId_fkey" FOREIGN KEY ("aquariumId") REFERENCES "Aquarium"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TankAuditSession" ADD CONSTRAINT "TankAuditSession_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TankAuditSession" ADD CONSTRAINT "TankAuditSession_finalizedById_fkey" FOREIGN KEY ("finalizedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TankAuditSession" ADD CONSTRAINT "TankAuditSession_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TankAuditLine" ADD CONSTRAINT "TankAuditLine_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TankAuditLine" ADD CONSTRAINT "TankAuditLine_auditSessionId_fkey" FOREIGN KEY ("auditSessionId") REFERENCES "TankAuditSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TankAuditLine" ADD CONSTRAINT "TankAuditLine_aquariumItemId_fkey" FOREIGN KEY ("aquariumItemId") REFERENCES "AquariumItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TankAuditLine" ADD CONSTRAINT "TankAuditLine_speciesDefinitionId_fkey" FOREIGN KEY ("speciesDefinitionId") REFERENCES "SpeciesDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TankAuditLine" ADD CONSTRAINT "TankAuditLine_equipmentProfileId_fkey" FOREIGN KEY ("equipmentProfileId") REFERENCES "EquipmentProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
