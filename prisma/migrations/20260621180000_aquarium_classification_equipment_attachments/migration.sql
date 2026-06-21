CREATE TYPE "AquariumSalinity" AS ENUM ('FRESHWATER', 'BRACKISH', 'MARINE');
CREATE TYPE "AquariumType" AS ENUM ('DISPLAY', 'QUARANTINE', 'HOSPITAL', 'POND', 'BREEDING', 'GROW_OUT', 'FRAG', 'HOLDING', 'OTHER');
CREATE TYPE "AquariumEquipmentRole" AS ENUM ('LIGHT', 'FILTER', 'HEATER', 'SUBSTRATE', 'CO2', 'AERATION', 'CONTROLLER', 'PUMP', 'CHILLER', 'UV', 'DOSER', 'AUTO_TOP_OFF', 'MONITOR', 'OTHER');

ALTER TABLE "Aquarium"
  ADD COLUMN "salinity" "AquariumSalinity" NOT NULL DEFAULT 'FRESHWATER',
  ADD COLUMN "aquariumType" "AquariumType" NOT NULL DEFAULT 'DISPLAY';

UPDATE "Aquarium"
SET "salinity" = CASE
  WHEN "tankType"::text = 'BRACKISH' THEN 'BRACKISH'::"AquariumSalinity"
  WHEN "tankType"::text = 'SALTWATER' THEN 'MARINE'::"AquariumSalinity"
  ELSE 'FRESHWATER'::"AquariumSalinity"
END,
"aquariumType" = CASE
  WHEN "tankType"::text = 'QUARANTINE' THEN 'QUARANTINE'::"AquariumType"
  WHEN "tankType"::text = 'POND' THEN 'POND'::"AquariumType"
  WHEN "tankType"::text = 'GROWOUT' THEN 'GROW_OUT'::"AquariumType"
  WHEN "tankType"::text = 'OTHER' THEN 'OTHER'::"AquariumType"
  ELSE 'DISPLAY'::"AquariumType"
END;

CREATE TABLE "AquariumEquipmentAttachment" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "aquariumId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "role" "AquariumEquipmentRole" NOT NULL,
  "notes" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AquariumEquipmentAttachment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AquariumEquipmentAttachment_aquariumId_itemId_role_key" ON "AquariumEquipmentAttachment"("aquariumId", "itemId", "role");
CREATE INDEX "AquariumEquipmentAttachment_collectionId_aquariumId_role_sortOrder_idx" ON "AquariumEquipmentAttachment"("collectionId", "aquariumId", "role", "sortOrder");
CREATE INDEX "AquariumEquipmentAttachment_itemId_idx" ON "AquariumEquipmentAttachment"("itemId");

ALTER TABLE "AquariumEquipmentAttachment" ADD CONSTRAINT "AquariumEquipmentAttachment_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AquariumEquipmentAttachment" ADD CONSTRAINT "AquariumEquipmentAttachment_aquariumId_fkey" FOREIGN KEY ("aquariumId") REFERENCES "Aquarium"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AquariumEquipmentAttachment" ADD CONSTRAINT "AquariumEquipmentAttachment_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "AquariumItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "AquariumEquipmentAttachment" ("id", "collectionId", "aquariumId", "itemId", "role", "sortOrder")
SELECT 'legacy-' || md5(p."aquariumId" || p."substrateItemId" || 'SUBSTRATE'), a."collectionId", p."aquariumId", p."substrateItemId", 'SUBSTRATE'::"AquariumEquipmentRole", 0
FROM "AquariumProfile" p JOIN "Aquarium" a ON a."id" = p."aquariumId"
WHERE p."substrateItemId" IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO "AquariumEquipmentAttachment" ("id", "collectionId", "aquariumId", "itemId", "role", "sortOrder")
SELECT 'legacy-' || md5(p."aquariumId" || p."lightItemId" || 'LIGHT'), a."collectionId", p."aquariumId", p."lightItemId", 'LIGHT'::"AquariumEquipmentRole", 0
FROM "AquariumProfile" p JOIN "Aquarium" a ON a."id" = p."aquariumId"
WHERE p."lightItemId" IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO "AquariumEquipmentAttachment" ("id", "collectionId", "aquariumId", "itemId", "role", "sortOrder")
SELECT 'legacy-' || md5(p."aquariumId" || p."heaterItemId" || 'HEATER'), a."collectionId", p."aquariumId", p."heaterItemId", 'HEATER'::"AquariumEquipmentRole", 0
FROM "AquariumProfile" p JOIN "Aquarium" a ON a."id" = p."aquariumId"
WHERE p."heaterItemId" IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO "AquariumEquipmentAttachment" ("id", "collectionId", "aquariumId", "itemId", "role", "sortOrder")
SELECT 'legacy-' || md5(i."aquariumId" || i."id" || COALESCE(e."equipmentType"::text, 'OTHER')), i."collectionId", i."aquariumId", i."id",
  CASE e."equipmentType"::text
    WHEN 'LIGHT' THEN 'LIGHT'::"AquariumEquipmentRole"
    WHEN 'FILTER' THEN 'FILTER'::"AquariumEquipmentRole"
    WHEN 'HEATER' THEN 'HEATER'::"AquariumEquipmentRole"
    WHEN 'CO2' THEN 'CO2'::"AquariumEquipmentRole"
    WHEN 'AIR_PUMP' THEN 'AERATION'::"AquariumEquipmentRole"
    WHEN 'CONTROLLER' THEN 'CONTROLLER'::"AquariumEquipmentRole"
    WHEN 'PUMP' THEN 'PUMP'::"AquariumEquipmentRole"
    WHEN 'DOSER' THEN 'DOSER'::"AquariumEquipmentRole"
    WHEN 'SENSOR' THEN 'MONITOR'::"AquariumEquipmentRole"
    ELSE 'OTHER'::"AquariumEquipmentRole"
  END,
  0
FROM "AquariumItem" i LEFT JOIN "EquipmentProfile" e ON e."itemId" = i."id"
WHERE i."aquariumId" IS NOT NULL AND i."itemType"::text = 'EQUIPMENT'
ON CONFLICT DO NOTHING;

INSERT INTO "AquariumEquipmentAttachment" ("id", "collectionId", "aquariumId", "itemId", "role", "sortOrder")
SELECT 'legacy-' || md5(i."aquariumId" || i."id" || 'SUBSTRATE'), i."collectionId", i."aquariumId", i."id", 'SUBSTRATE'::"AquariumEquipmentRole", 0
FROM "AquariumItem" i
WHERE i."aquariumId" IS NOT NULL AND i."itemType"::text = 'SUBSTRATE'
ON CONFLICT DO NOTHING;

-- Legacy tankType and AquariumProfile slot/free-text columns intentionally remain for
-- rolling-deploy safety. New application reads and writes use the fields and join table above.
