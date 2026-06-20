CREATE TYPE "VolumeUnit" AS ENUM ('GALLON', 'LITER');

ALTER TABLE "User" ADD COLUMN "lastLoginAt" TIMESTAMP(3), ADD COLUMN "disabledAt" TIMESTAMP(3);
ALTER TABLE "Collection" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "Aquarium" ADD COLUMN "volumeUnit" "VolumeUnit" NOT NULL DEFAULT 'GALLON';
ALTER TABLE "SpeciesDefinition" ADD COLUMN "salinityMin" DOUBLE PRECISION, ADD COLUMN "salinityMax" DOUBLE PRECISION;
ALTER TABLE "MedicationDefinition" ADD COLUMN "dosePerVolume" DOUBLE PRECISION, ADD COLUMN "doseVolumeUnit" "VolumeUnit" NOT NULL DEFAULT 'GALLON';
UPDATE "MedicationDefinition" SET "dosePerVolume" = "dosePerGallons" WHERE "dosePerGallons" IS NOT NULL;
ALTER TABLE "LightingSchedulePoint" ADD COLUMN "rampMinutes" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "CollectionMembership" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "CollectionRole" NOT NULL DEFAULT 'VIEWER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CollectionMembership_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CollectionMembership_collectionId_userId_key" ON "CollectionMembership"("collectionId", "userId");
CREATE INDEX "CollectionMembership_userId_idx" ON "CollectionMembership"("userId");
ALTER TABLE "CollectionMembership" ADD CONSTRAINT "CollectionMembership_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CollectionMembership" ADD CONSTRAINT "CollectionMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
INSERT INTO "CollectionMembership" ("id", "collectionId", "userId", "role", "updatedAt")
SELECT 'owner-' || "id", "id", "ownerId", 'OWNER', CURRENT_TIMESTAMP FROM "Collection" ON CONFLICT DO NOTHING;
