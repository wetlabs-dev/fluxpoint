-- Persist one validated active collection per user.
ALTER TABLE "User" ADD COLUMN "activeCollectionId" TEXT;
ALTER TABLE "User" ADD CONSTRAINT "User_activeCollectionId_fkey"
  FOREIGN KEY ("activeCollectionId") REFERENCES "Collection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "User_activeCollectionId_idx" ON "User"("activeCollectionId");

-- Aquarium.name has been canonical since the aquarium identity migration.
-- generatedName had no remaining readers or writers at removal time.
ALTER TABLE "Aquarium" DROP COLUMN "generatedName";

CREATE TYPE "AiJobType" AS ENUM ('AQUARIUM_COVER_IMAGE_GENERATION');
CREATE TYPE "AiJobStatus" AS ENUM ('PENDING', 'CLAIMED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'DEAD_LETTER');

CREATE TABLE "AiJob" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "jobType" "AiJobType" NOT NULL,
  "status" "AiJobStatus" NOT NULL DEFAULT 'PENDING',
  "priority" INTEGER NOT NULL DEFAULT 100,
  "payload" JSONB NOT NULL,
  "result" JSONB,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claimedAt" TIMESTAMP(3),
  "claimedBy" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "idempotencyKey" TEXT,
  "progress" INTEGER,
  "progressMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiJob_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AiJob_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AiJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AiJob_idempotencyKey_key" ON "AiJob"("idempotencyKey");
CREATE INDEX "AiJob_status_availableAt_priority_idx" ON "AiJob"("status", "availableAt", "priority");
CREATE INDEX "AiJob_collectionId_status_idx" ON "AiJob"("collectionId", "status");
CREATE INDEX "AiJob_userId_createdAt_idx" ON "AiJob"("userId", "createdAt");
CREATE INDEX "AiJob_jobType_status_idx" ON "AiJob"("jobType", "status");
