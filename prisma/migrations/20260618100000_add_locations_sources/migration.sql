ALTER TYPE "ItemType" ADD VALUE IF NOT EXISTS 'SUBSTRATE';
ALTER TYPE "WaterParameter" ADD VALUE IF NOT EXISTS 'CO2';

CREATE TYPE "LocationType" AS ENUM ('ROOM', 'RACK', 'SHELF', 'STAND', 'CABINET', 'OUTDOOR_AREA', 'OTHER');
CREATE TYPE "SourceType" AS ENUM ('STORE', 'ONLINE_VENDOR', 'BREEDER', 'LOCAL_CLUB', 'FRIEND', 'IMPORTER', 'SELF_PROPAGATED', 'OTHER');

CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "type" "LocationType" NOT NULL DEFAULT 'OTHER',
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "SourceType" NOT NULL DEFAULT 'OTHER',
    "website" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Aquarium" ADD COLUMN "locationId" TEXT;
ALTER TABLE "AquariumProfile" ADD COLUMN "substrateItemId" TEXT;
ALTER TABLE "AquariumProfile" ADD COLUMN "lightItemId" TEXT;
ALTER TABLE "AquariumItem" ADD COLUMN "sourceId" TEXT;
ALTER TABLE "AquariumItem" ADD COLUMN "purchasePrice" DECIMAL(10,2);

CREATE INDEX "Location_collectionId_parentId_idx" ON "Location"("collectionId", "parentId");
CREATE INDEX "Source_collectionId_name_idx" ON "Source"("collectionId", "name");
CREATE INDEX "Aquarium_locationId_idx" ON "Aquarium"("locationId");
CREATE INDEX "AquariumItem_sourceId_idx" ON "AquariumItem"("sourceId");

ALTER TABLE "Location" ADD CONSTRAINT "Location_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Location" ADD CONSTRAINT "Location_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Source" ADD CONSTRAINT "Source_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Aquarium" ADD CONSTRAINT "Aquarium_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AquariumProfile" ADD CONSTRAINT "AquariumProfile_substrateItemId_fkey" FOREIGN KEY ("substrateItemId") REFERENCES "AquariumItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AquariumProfile" ADD CONSTRAINT "AquariumProfile_lightItemId_fkey" FOREIGN KEY ("lightItemId") REFERENCES "AquariumItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AquariumItem" ADD CONSTRAINT "AquariumItem_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;
