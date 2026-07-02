CREATE TYPE "PublicLocationMode" AS ENUM ('HIDDEN', 'REGION_ONLY', 'CITY_STATE_COUNTRY');

CREATE TABLE "CollectionPublicProfile" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "isPublicEnabled" BOOLEAN NOT NULL DEFAULT false,
  "publicSlug" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "tagline" TEXT,
  "description" TEXT,
  "publicLocationMode" "PublicLocationMode" NOT NULL DEFAULT 'HIDDEN',
  "showOwnerName" BOOLEAN NOT NULL DEFAULT false,
  "showTankList" BOOLEAN NOT NULL DEFAULT true,
  "showSpeciesList" BOOLEAN NOT NULL DEFAULT true,
  "showMetrics" BOOLEAN NOT NULL DEFAULT false,
  "showTimeline" BOOLEAN NOT NULL DEFAULT false,
  "showEquipment" BOOLEAN NOT NULL DEFAULT false,
  "showQrLandingPages" BOOLEAN NOT NULL DEFAULT true,
  "allowSearchIndexing" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CollectionPublicProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AquariumPublicProfile" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "aquariumId" TEXT NOT NULL,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "publicSlug" TEXT NOT NULL,
  "publicTitle" TEXT,
  "publicSubtitle" TEXT,
  "publicDescription" TEXT,
  "showCoverPhoto" BOOLEAN NOT NULL DEFAULT true,
  "showInhabitants" BOOLEAN NOT NULL DEFAULT true,
  "showPlants" BOOLEAN NOT NULL DEFAULT true,
  "showEquipment" BOOLEAN NOT NULL DEFAULT false,
  "showMetrics" BOOLEAN NOT NULL DEFAULT false,
  "showSchedules" BOOLEAN NOT NULL DEFAULT false,
  "showTimeline" BOOLEAN NOT NULL DEFAULT false,
  "showConditions" BOOLEAN NOT NULL DEFAULT false,
  "showStockingPressure" BOOLEAN NOT NULL DEFAULT true,
  "showEddySummary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AquariumPublicProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AquariumItemPublicProfile" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "publicSlug" TEXT,
  "publicTitle" TEXT,
  "publicDescription" TEXT,
  "showQuantity" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AquariumItemPublicProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CollectionPublicProfile_collectionId_key" ON "CollectionPublicProfile"("collectionId");
CREATE UNIQUE INDEX "CollectionPublicProfile_publicSlug_key" ON "CollectionPublicProfile"("publicSlug");
CREATE INDEX "CollectionPublicProfile_isPublicEnabled_publicSlug_idx" ON "CollectionPublicProfile"("isPublicEnabled", "publicSlug");
CREATE UNIQUE INDEX "AquariumPublicProfile_aquariumId_key" ON "AquariumPublicProfile"("aquariumId");
CREATE UNIQUE INDEX "AquariumPublicProfile_collectionId_publicSlug_key" ON "AquariumPublicProfile"("collectionId", "publicSlug");
CREATE INDEX "AquariumPublicProfile_isPublished_publicSlug_idx" ON "AquariumPublicProfile"("isPublished", "publicSlug");
CREATE UNIQUE INDEX "AquariumItemPublicProfile_itemId_key" ON "AquariumItemPublicProfile"("itemId");
CREATE UNIQUE INDEX "AquariumItemPublicProfile_collectionId_publicSlug_key" ON "AquariumItemPublicProfile"("collectionId", "publicSlug");
CREATE INDEX "AquariumItemPublicProfile_isPublished_publicSlug_idx" ON "AquariumItemPublicProfile"("isPublished", "publicSlug");

ALTER TABLE "CollectionPublicProfile" ADD CONSTRAINT "CollectionPublicProfile_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AquariumPublicProfile" ADD CONSTRAINT "AquariumPublicProfile_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AquariumPublicProfile" ADD CONSTRAINT "AquariumPublicProfile_aquariumId_fkey" FOREIGN KEY ("aquariumId") REFERENCES "Aquarium"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AquariumItemPublicProfile" ADD CONSTRAINT "AquariumItemPublicProfile_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AquariumItemPublicProfile" ADD CONSTRAINT "AquariumItemPublicProfile_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "AquariumItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
