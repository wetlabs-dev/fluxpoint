ALTER TYPE "AquariumItemStatus" ADD VALUE IF NOT EXISTS 'IN_AQUARIUM';
ALTER TYPE "AquariumItemStatus" ADD VALUE IF NOT EXISTS 'IN_STORAGE';
ALTER TYPE "AquariumItemStatus" ADD VALUE IF NOT EXISTS 'IN_QUARANTINE';

ALTER TYPE "LocationType" ADD VALUE IF NOT EXISTS 'BIN';
ALTER TYPE "LocationType" ADD VALUE IF NOT EXISTS 'DRAWER';
ALTER TYPE "LocationType" ADD VALUE IF NOT EXISTS 'REFRIGERATOR';
ALTER TYPE "LocationType" ADD VALUE IF NOT EXISTS 'FREEZER';

CREATE TYPE "LightCapabilityMode" AS ENUM ('ON_OFF', 'DIMMABLE', 'RGB', 'RGBW', 'CUSTOM');
CREATE TYPE "QuarantineProjectStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE "QuarantineItemStatus" AS ENUM ('ACTIVE', 'CLEARED', 'FAILED', 'TRANSFERRED');

CREATE TABLE "LightCapabilityProfile" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "mode" "LightCapabilityMode" NOT NULL DEFAULT 'DIMMABLE',
  "pointCount" INTEGER NOT NULL DEFAULT 3,
  "channels" JSONB NOT NULL,
  "granularity" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LightCapabilityProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuarantineProject" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "aquariumId" TEXT,
  "status" "QuarantineProjectStatus" NOT NULL DEFAULT 'ACTIVE',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "reason" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "QuarantineProject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuarantineItem" (
  "id" TEXT NOT NULL,
  "quarantineProjectId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL,
  "status" "QuarantineItemStatus" NOT NULL DEFAULT 'ACTIVE',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "clearedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "QuarantineItem_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AquariumItem"
  ADD COLUMN "storageLocationId" TEXT,
  ADD COLUMN "quarantineProjectId" TEXT;

ALTER TABLE "ItemTransfer"
  ADD COLUMN "destinationItemId" TEXT,
  ADD COLUMN "fromStorageLocationId" TEXT,
  ADD COLUMN "toStorageLocationId" TEXT,
  ADD COLUMN "fromQuarantineProjectId" TEXT,
  ADD COLUMN "toQuarantineProjectId" TEXT,
  ADD COLUMN "metadata" JSONB,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "EquipmentProfile"
  ADD COLUMN "lightCapabilityProfileId" TEXT;

ALTER TABLE "LightingSchedule"
  ADD COLUMN "capabilityProfileId" TEXT;

ALTER TABLE "LightingSchedulePoint"
  ADD COLUMN "values" JSONB;

DROP INDEX IF EXISTS "AquariumLightingAssignment_aquariumId_key";

CREATE UNIQUE INDEX "LightCapabilityProfile_collectionId_name_key" ON "LightCapabilityProfile"("collectionId", "name");
CREATE INDEX "LightCapabilityProfile_collectionId_mode_idx" ON "LightCapabilityProfile"("collectionId", "mode");
CREATE INDEX "QuarantineProject_collectionId_status_idx" ON "QuarantineProject"("collectionId", "status");
CREATE INDEX "QuarantineProject_aquariumId_idx" ON "QuarantineProject"("aquariumId");
CREATE INDEX "QuarantineItem_quarantineProjectId_status_idx" ON "QuarantineItem"("quarantineProjectId", "status");
CREATE INDEX "QuarantineItem_itemId_idx" ON "QuarantineItem"("itemId");
CREATE INDEX "AquariumItem_collectionId_status_idx" ON "AquariumItem"("collectionId", "status");
CREATE INDEX "AquariumItem_aquariumId_idx" ON "AquariumItem"("aquariumId");
CREATE INDEX "AquariumItem_storageLocationId_idx" ON "AquariumItem"("storageLocationId");
CREATE INDEX "AquariumItem_quarantineProjectId_idx" ON "AquariumItem"("quarantineProjectId");
CREATE INDEX "ItemTransfer_itemId_transferredAt_idx" ON "ItemTransfer"("itemId", "transferredAt");
CREATE INDEX "ItemTransfer_destinationItemId_idx" ON "ItemTransfer"("destinationItemId");
CREATE INDEX "EquipmentProfile_lightCapabilityProfileId_idx" ON "EquipmentProfile"("lightCapabilityProfileId");
CREATE INDEX "LightingSchedule_capabilityProfileId_idx" ON "LightingSchedule"("capabilityProfileId");
CREATE INDEX "AquariumLightingAssignment_aquariumId_idx" ON "AquariumLightingAssignment"("aquariumId");
CREATE UNIQUE INDEX "AquariumLightingAssignment_aquariumId_equipmentItemId_key" ON "AquariumLightingAssignment"("aquariumId", "equipmentItemId");

ALTER TABLE "LightCapabilityProfile" ADD CONSTRAINT "LightCapabilityProfile_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuarantineProject" ADD CONSTRAINT "QuarantineProject_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuarantineProject" ADD CONSTRAINT "QuarantineProject_aquariumId_fkey" FOREIGN KEY ("aquariumId") REFERENCES "Aquarium"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QuarantineItem" ADD CONSTRAINT "QuarantineItem_quarantineProjectId_fkey" FOREIGN KEY ("quarantineProjectId") REFERENCES "QuarantineProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuarantineItem" ADD CONSTRAINT "QuarantineItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "AquariumItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AquariumItem" ADD CONSTRAINT "AquariumItem_storageLocationId_fkey" FOREIGN KEY ("storageLocationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AquariumItem" ADD CONSTRAINT "AquariumItem_quarantineProjectId_fkey" FOREIGN KEY ("quarantineProjectId") REFERENCES "QuarantineProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ItemTransfer" ADD CONSTRAINT "ItemTransfer_destinationItemId_fkey" FOREIGN KEY ("destinationItemId") REFERENCES "AquariumItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ItemTransfer" ADD CONSTRAINT "ItemTransfer_fromStorageLocationId_fkey" FOREIGN KEY ("fromStorageLocationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ItemTransfer" ADD CONSTRAINT "ItemTransfer_toStorageLocationId_fkey" FOREIGN KEY ("toStorageLocationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ItemTransfer" ADD CONSTRAINT "ItemTransfer_fromQuarantineProjectId_fkey" FOREIGN KEY ("fromQuarantineProjectId") REFERENCES "QuarantineProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ItemTransfer" ADD CONSTRAINT "ItemTransfer_toQuarantineProjectId_fkey" FOREIGN KEY ("toQuarantineProjectId") REFERENCES "QuarantineProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EquipmentProfile" ADD CONSTRAINT "EquipmentProfile_lightCapabilityProfileId_fkey" FOREIGN KEY ("lightCapabilityProfileId") REFERENCES "LightCapabilityProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LightingSchedule" ADD CONSTRAINT "LightingSchedule_capabilityProfileId_fkey" FOREIGN KEY ("capabilityProfileId") REFERENCES "LightCapabilityProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
