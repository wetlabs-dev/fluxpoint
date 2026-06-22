ALTER TYPE "MaintenanceType" ADD VALUE IF NOT EXISTS 'REPAIR_SERVICE';

CREATE TYPE "LabelType" AS ENUM ('SIMPLE_QR', 'ENTITY_DETAIL', 'EQUIPMENT_DETAIL', 'TANK_DETAIL', 'AQUARIUM_LIVESTOCK_SHEET');
CREATE TYPE "LabelFormat" AS ENUM ('PDF');

ALTER TABLE "QrCode"
  ADD COLUMN "collectionId" TEXT,
  ADD COLUMN "publicCode" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "QrCode" qr
SET "collectionId" = a."collectionId"
FROM "Aquarium" a
WHERE lower(qr."entityType") = 'aquarium' AND qr."entityId" = a.id;

UPDATE "QrCode" qr
SET "collectionId" = i."collectionId"
FROM "AquariumItem" i
WHERE lower(qr."entityType") IN ('aquariumitem', 'item', 'inventory', 'equipment') AND qr."entityId" = i.id;

UPDATE "QrCode" SET "entityType" = 'TANK' WHERE upper("entityType") = 'AQUARIUM';
UPDATE "QrCode" qr
SET "entityType" = CASE WHEN i."itemType" = 'EQUIPMENT' THEN 'EQUIPMENT' ELSE 'INVENTORY' END
FROM "AquariumItem" i
WHERE qr."entityId" = i.id AND upper(qr."entityType") IN ('AQUARIUMITEM', 'ITEM');

DELETE FROM "QrCode" WHERE "collectionId" IS NULL;
DELETE FROM "QrCode" duplicate
USING "QrCode" keeper
WHERE duplicate."entityType" = keeper."entityType"
  AND duplicate."entityId" = keeper."entityId"
  AND (duplicate."createdAt", duplicate.id) > (keeper."createdAt", keeper.id);
UPDATE "QrCode" SET "publicCode" = lower(substr(md5(random()::text || id), 1, 12));
ALTER TABLE "QrCode" ALTER COLUMN "collectionId" SET NOT NULL;
ALTER TABLE "QrCode" ALTER COLUMN "publicCode" SET NOT NULL;

CREATE UNIQUE INDEX "QrCode_publicCode_key" ON "QrCode"("publicCode");
CREATE UNIQUE INDEX "QrCode_entityType_entityId_key" ON "QrCode"("entityType", "entityId");
CREATE INDEX "QrCode_collectionId_createdAt_idx" ON "QrCode"("collectionId", "createdAt");
ALTER TABLE "QrCode" ADD CONSTRAINT "QrCode_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "GeneratedLabel" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "qrCodeId" TEXT,
  "labelType" "LabelType" NOT NULL,
  "format" "LabelFormat" NOT NULL DEFAULT 'PDF',
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "storagePath" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GeneratedLabel_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GeneratedLabel_collectionId_entityType_entityId_createdAt_idx" ON "GeneratedLabel"("collectionId", "entityType", "entityId", "createdAt");
CREATE INDEX "GeneratedLabel_qrCodeId_createdAt_idx" ON "GeneratedLabel"("qrCodeId", "createdAt");
ALTER TABLE "GeneratedLabel" ADD CONSTRAINT "GeneratedLabel_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GeneratedLabel" ADD CONSTRAINT "GeneratedLabel_qrCodeId_fkey" FOREIGN KEY ("qrCodeId") REFERENCES "QrCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GeneratedLabel" ADD CONSTRAINT "GeneratedLabel_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
