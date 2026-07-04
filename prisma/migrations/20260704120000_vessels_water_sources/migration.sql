-- Physical aquarium vessel support.
ALTER TYPE "AquariumEquipmentRole" ADD VALUE IF NOT EXISTS 'AQUARIUM_VESSEL';
ALTER TYPE "EquipmentType" ADD VALUE IF NOT EXISTS 'AQUARIUM_VESSEL';

-- Structured water sources and recipes.
CREATE TYPE "WaterSourceType" AS ENUM ('RODI', 'TAP', 'WELL', 'RAIN', 'SPRING', 'MIXED', 'OTHER');
CREATE TYPE "WaterRecipeDoseUnit" AS ENUM ('G', 'MG', 'TSP', 'TBSP', 'ML', 'DROPS', 'CAPFUL', 'SCOOP', 'OTHER');
CREATE TYPE "WaterRecipeVolumeUnit" AS ENUM ('GALLON', 'LITER');

CREATE TABLE "WaterSource" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "sourceType" "WaterSourceType" NOT NULL DEFAULT 'OTHER',
  "baselinePh" DOUBLE PRECISION,
  "baselineGh" DOUBLE PRECISION,
  "baselineKh" DOUBLE PRECISION,
  "baselineTds" DOUBLE PRECISION,
  "baselineSalinity" DOUBLE PRECISION,
  "notes" TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WaterSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WaterRecipe" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "waterSourceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "targetPh" DOUBLE PRECISION,
  "targetGh" DOUBLE PRECISION,
  "targetKh" DOUBLE PRECISION,
  "targetTds" DOUBLE PRECISION,
  "targetSalinity" DOUBLE PRECISION,
  "notes" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WaterRecipe_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WaterRecipeAdditive" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "waterRecipeId" TEXT NOT NULL,
  "inventoryItemId" TEXT,
  "additiveName" TEXT NOT NULL,
  "doseAmount" DOUBLE PRECISION NOT NULL,
  "doseUnit" "WaterRecipeDoseUnit" NOT NULL DEFAULT 'ML',
  "perVolumeAmount" DOUBLE PRECISION NOT NULL,
  "perVolumeUnit" "WaterRecipeVolumeUnit" NOT NULL DEFAULT 'GALLON',
  "instructions" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WaterRecipeAdditive_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Aquarium" ADD COLUMN "waterSourceId" TEXT;
ALTER TABLE "Aquarium" ADD COLUMN "waterRecipeId" TEXT;

CREATE INDEX "WaterSource_collectionId_archivedAt_idx" ON "WaterSource"("collectionId", "archivedAt");
CREATE UNIQUE INDEX "WaterSource_collectionId_name_key" ON "WaterSource"("collectionId", "name");
CREATE INDEX "WaterRecipe_collectionId_waterSourceId_isActive_idx" ON "WaterRecipe"("collectionId", "waterSourceId", "isActive");
CREATE UNIQUE INDEX "WaterRecipe_collectionId_waterSourceId_name_key" ON "WaterRecipe"("collectionId", "waterSourceId", "name");
CREATE INDEX "WaterRecipeAdditive_collectionId_waterRecipeId_idx" ON "WaterRecipeAdditive"("collectionId", "waterRecipeId");
CREATE INDEX "WaterRecipeAdditive_inventoryItemId_idx" ON "WaterRecipeAdditive"("inventoryItemId");
CREATE INDEX "Aquarium_waterSourceId_idx" ON "Aquarium"("waterSourceId");
CREATE INDEX "Aquarium_waterRecipeId_idx" ON "Aquarium"("waterRecipeId");

ALTER TABLE "WaterSource" ADD CONSTRAINT "WaterSource_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WaterRecipe" ADD CONSTRAINT "WaterRecipe_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WaterRecipe" ADD CONSTRAINT "WaterRecipe_waterSourceId_fkey" FOREIGN KEY ("waterSourceId") REFERENCES "WaterSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WaterRecipeAdditive" ADD CONSTRAINT "WaterRecipeAdditive_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WaterRecipeAdditive" ADD CONSTRAINT "WaterRecipeAdditive_waterRecipeId_fkey" FOREIGN KEY ("waterRecipeId") REFERENCES "WaterRecipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WaterRecipeAdditive" ADD CONSTRAINT "WaterRecipeAdditive_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "AquariumItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Aquarium" ADD CONSTRAINT "Aquarium_waterSourceId_fkey" FOREIGN KEY ("waterSourceId") REFERENCES "WaterSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Aquarium" ADD CONSTRAINT "Aquarium_waterRecipeId_fkey" FOREIGN KEY ("waterRecipeId") REFERENCES "WaterRecipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed safe starter source rows for every collection without overwriting existing data.
INSERT INTO "WaterSource" ("id", "collectionId", "name", "description", "sourceType", "isDefault", "updatedAt")
SELECT 'ws_' || substr(md5(c."id" || ':rodi'), 1, 22), c."id", 'RODI', 'Reverse osmosis/deionized source water.', 'RODI', true, CURRENT_TIMESTAMP
FROM "Collection" c
ON CONFLICT ("collectionId", "name") DO NOTHING;

INSERT INTO "WaterSource" ("id", "collectionId", "name", "description", "sourceType", "isDefault", "updatedAt")
SELECT 'ws_' || substr(md5(c."id" || ':dechlorinated-tap'), 1, 22), c."id", 'Dechlorinated Tap', 'Tap water after dechlorination or conditioner treatment.', 'TAP', false, CURRENT_TIMESTAMP
FROM "Collection" c
ON CONFLICT ("collectionId", "name") DO NOTHING;

-- Preserve old freeform profile water-source text as structured source rows and link aquariums.
INSERT INTO "WaterSource" ("id", "collectionId", "name", "description", "sourceType", "notes", "updatedAt")
SELECT
  'ws_' || substr(md5(a."collectionId" || ':' || trim(ap."waterSource")), 1, 22),
  a."collectionId",
  trim(ap."waterSource"),
  'Migrated from aquarium target water profile.',
  CASE
    WHEN lower(trim(ap."waterSource")) IN ('rodi', 'ro/di', 'ro di', 'reverse osmosis', 'reverse osmosis/deionized') THEN 'RODI'::"WaterSourceType"
    WHEN lower(trim(ap."waterSource")) LIKE '%tap%' THEN 'TAP'::"WaterSourceType"
    WHEN lower(trim(ap."waterSource")) LIKE '%well%' THEN 'WELL'::"WaterSourceType"
    WHEN lower(trim(ap."waterSource")) LIKE '%rain%' THEN 'RAIN'::"WaterSourceType"
    WHEN lower(trim(ap."waterSource")) LIKE '%spring%' THEN 'SPRING'::"WaterSourceType"
    ELSE 'OTHER'::"WaterSourceType"
  END,
  'The original freeform text remains on AquariumProfile.waterSource for compatibility.',
  CURRENT_TIMESTAMP
FROM "AquariumProfile" ap
JOIN "Aquarium" a ON a."id" = ap."aquariumId"
WHERE ap."waterSource" IS NOT NULL AND trim(ap."waterSource") <> ''
ON CONFLICT ("collectionId", "name") DO NOTHING;

UPDATE "Aquarium" a
SET "waterSourceId" = ws."id"
FROM "AquariumProfile" ap, "WaterSource" ws
WHERE ap."aquariumId" = a."id"
  AND ws."collectionId" = a."collectionId"
  AND ws."name" = trim(ap."waterSource")
  AND ap."waterSource" IS NOT NULL
  AND trim(ap."waterSource") <> ''
  AND a."waterSourceId" IS NULL;
