CREATE TYPE "CareScheduleType" AS ENUM ('MAINTENANCE', 'FEEDING', 'DOSING', 'TESTING', 'EQUIPMENT_SERVICE', 'WATER_CHANGE', 'OTHER');
CREATE TYPE "CareCadenceType" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'EVERY_N_DAYS', 'CUSTOM');
CREATE TYPE "CareTaskStatus" AS ENUM ('PENDING', 'COMPLETED', 'SKIPPED', 'OVERDUE');

CREATE TABLE "CareSchedule" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "aquariumId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scheduleType" "CareScheduleType" NOT NULL,
    "cadenceType" "CareCadenceType" NOT NULL,
    "intervalDays" INTEGER,
    "daysOfWeek" JSONB,
    "dayOfMonth" INTEGER,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "nextDueAt" TIMESTAMP(3),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareSchedule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CareTask" (
    "id" TEXT NOT NULL,
    "careScheduleId" TEXT NOT NULL,
    "aquariumId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "skippedAt" TIMESTAMP(3),
    "status" "CareTaskStatus" NOT NULL DEFAULT 'PENDING',
    "completedById" TEXT,
    "relatedEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareTask_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CareSchedule_collectionId_enabled_nextDueAt_idx" ON "CareSchedule"("collectionId", "enabled", "nextDueAt");
CREATE INDEX "CareSchedule_aquariumId_idx" ON "CareSchedule"("aquariumId");
CREATE INDEX "CareTask_aquariumId_status_dueAt_idx" ON "CareTask"("aquariumId", "status", "dueAt");
CREATE INDEX "CareTask_careScheduleId_status_dueAt_idx" ON "CareTask"("careScheduleId", "status", "dueAt");
CREATE INDEX "CareTask_completedById_idx" ON "CareTask"("completedById");
CREATE INDEX "CareTask_relatedEventId_idx" ON "CareTask"("relatedEventId");

ALTER TABLE "CareSchedule" ADD CONSTRAINT "CareSchedule_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CareSchedule" ADD CONSTRAINT "CareSchedule_aquariumId_fkey" FOREIGN KEY ("aquariumId") REFERENCES "Aquarium"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CareTask" ADD CONSTRAINT "CareTask_careScheduleId_fkey" FOREIGN KEY ("careScheduleId") REFERENCES "CareSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CareTask" ADD CONSTRAINT "CareTask_aquariumId_fkey" FOREIGN KEY ("aquariumId") REFERENCES "Aquarium"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CareTask" ADD CONSTRAINT "CareTask_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CareTask" ADD CONSTRAINT "CareTask_relatedEventId_fkey" FOREIGN KEY ("relatedEventId") REFERENCES "AquariumEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
