ALTER TABLE "AquariumEvent" ADD COLUMN "relatedItemId" TEXT;
ALTER TABLE "AquariumEvent" ADD COLUMN "maintenanceType" TEXT;
ALTER TABLE "AquariumEvent" ADD COLUMN "waterChangePercent" DOUBLE PRECISION;
ALTER TABLE "AquariumEvent" ADD COLUMN "waterChangeGallons" DOUBLE PRECISION;

CREATE TABLE "LightingSchedule" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LightingSchedule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LightingSchedulePoint" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "timeOfDay" TEXT NOT NULL,
    "white" INTEGER NOT NULL,
    "red" INTEGER NOT NULL,
    "green" INTEGER NOT NULL,
    "blue" INTEGER NOT NULL,
    "warmWhite" INTEGER,
    "intensity" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LightingSchedulePoint_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AquariumLightingAssignment" (
    "id" TEXT NOT NULL,
    "aquariumId" TEXT NOT NULL,
    "equipmentItemId" TEXT,
    "scheduleId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AquariumLightingAssignment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AquariumEvent_relatedItemId_idx" ON "AquariumEvent"("relatedItemId");
CREATE INDEX "LightingSchedule_collectionId_name_idx" ON "LightingSchedule"("collectionId", "name");
CREATE INDEX "LightingSchedulePoint_scheduleId_sortOrder_idx" ON "LightingSchedulePoint"("scheduleId", "sortOrder");
CREATE UNIQUE INDEX "AquariumLightingAssignment_aquariumId_key" ON "AquariumLightingAssignment"("aquariumId");
CREATE INDEX "AquariumLightingAssignment_scheduleId_idx" ON "AquariumLightingAssignment"("scheduleId");
CREATE INDEX "AquariumLightingAssignment_equipmentItemId_idx" ON "AquariumLightingAssignment"("equipmentItemId");

ALTER TABLE "AquariumEvent" ADD CONSTRAINT "AquariumEvent_relatedItemId_fkey" FOREIGN KEY ("relatedItemId") REFERENCES "AquariumItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LightingSchedule" ADD CONSTRAINT "LightingSchedule_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LightingSchedulePoint" ADD CONSTRAINT "LightingSchedulePoint_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "LightingSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AquariumLightingAssignment" ADD CONSTRAINT "AquariumLightingAssignment_aquariumId_fkey" FOREIGN KEY ("aquariumId") REFERENCES "Aquarium"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AquariumLightingAssignment" ADD CONSTRAINT "AquariumLightingAssignment_equipmentItemId_fkey" FOREIGN KEY ("equipmentItemId") REFERENCES "AquariumItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AquariumLightingAssignment" ADD CONSTRAINT "AquariumLightingAssignment_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "LightingSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
