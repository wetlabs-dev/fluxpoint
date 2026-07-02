-- Workflow Builder v1: keep the original lightweight workflow rows valid while
-- adding collection-scoped templates, durable run snapshots, and scheduled alerts.

ALTER TYPE "WorkflowStepType" ADD VALUE IF NOT EXISTS 'INSTRUCTION';
ALTER TYPE "WorkflowStepType" ADD VALUE IF NOT EXISTS 'MEASUREMENT';
ALTER TYPE "WorkflowStepType" ADD VALUE IF NOT EXISTS 'ALERT';
ALTER TYPE "WorkflowStepType" ADD VALUE IF NOT EXISTS 'CHECKLIST';

ALTER TYPE "WorkflowRunStatus" ADD VALUE IF NOT EXISTS 'NOT_STARTED';
ALTER TYPE "WorkflowRunStatus" ADD VALUE IF NOT EXISTS 'RUNNING';

ALTER TYPE "WorkflowStepRunStatus" ADD VALUE IF NOT EXISTS 'READY';
ALTER TYPE "WorkflowStepRunStatus" ADD VALUE IF NOT EXISTS 'WAITING';
ALTER TYPE "WorkflowStepRunStatus" ADD VALUE IF NOT EXISTS 'DUE';
ALTER TYPE "WorkflowStepRunStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'WORKFLOW_REMINDER';
ALTER TYPE "AquariumEventType" ADD VALUE IF NOT EXISTS 'WORKFLOW';

CREATE TYPE "WorkflowTemplateStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "WorkflowNotificationStatus" AS ENUM ('SCHEDULED', 'SENT', 'SKIPPED', 'CANCELLED', 'FAILED');

ALTER TABLE "WorkflowTemplate"
  ADD COLUMN "collectionId" TEXT,
  ADD COLUMN "status" "WorkflowTemplateStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "defaultAquariumId" TEXT,
  ADD COLUMN "defaultDurationMinutes" INTEGER,
  ADD COLUMN "createdById" TEXT;

ALTER TABLE "WorkflowStep"
  ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "waitAfterPreviousMinutes" INTEGER,
  ADD COLUMN "alertOffsetMinutes" INTEGER,
  ADD COLUMN "alertChannels" JSONB,
  ADD COLUMN "isRequired" BOOLEAN NOT NULL DEFAULT true;

UPDATE "WorkflowStep" SET "sortOrder" = "order" WHERE "sortOrder" = 0;

ALTER TABLE "WorkflowRun"
  ADD COLUMN "collectionId" TEXT,
  ADD COLUMN "title" TEXT,
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "startedById" TEXT,
  ALTER COLUMN "aquariumId" DROP NOT NULL;

UPDATE "WorkflowRun" wr
SET
  "collectionId" = a."collectionId",
  "title" = wt."name"
FROM "Aquarium" a, "WorkflowTemplate" wt
WHERE wr."aquariumId" = a."id"
  AND wr."workflowTemplateId" = wt."id";

ALTER TABLE "WorkflowStepRun"
  ADD COLUMN "collectionId" TEXT,
  ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "titleSnapshot" TEXT,
  ADD COLUMN "descriptionSnapshot" TEXT,
  ADD COLUMN "stepTypeSnapshot" "WorkflowStepType",
  ADD COLUMN "configSnapshot" JSONB,
  ADD COLUMN "readyAt" TIMESTAMP(3),
  ADD COLUMN "dueAt" TIMESTAMP(3),
  ADD COLUMN "completedById" TEXT,
  ADD COLUMN "result" JSONB;

UPDATE "WorkflowStepRun" wsr
SET
  "collectionId" = wr."collectionId",
  "sortOrder" = ws."sortOrder",
  "titleSnapshot" = ws."title",
  "descriptionSnapshot" = ws."description",
  "stepTypeSnapshot" = ws."stepType",
  "configSnapshot" = ws."config",
  "readyAt" = wr."startedAt"
FROM "WorkflowRun" wr, "WorkflowStep" ws
WHERE wsr."workflowRunId" = wr."id"
  AND wsr."workflowStepId" = ws."id";

CREATE TABLE "WorkflowNotification" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT,
  "workflowRunId" TEXT NOT NULL,
  "workflowStepRunId" TEXT,
  "channel" "NotificationChannel" NOT NULL,
  "status" "WorkflowNotificationStatus" NOT NULL DEFAULT 'SCHEDULED',
  "title" TEXT NOT NULL,
  "body" TEXT,
  "scheduledFor" TIMESTAMP(3) NOT NULL,
  "sentAt" TIMESTAMP(3),
  "dedupeKey" TEXT NOT NULL,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkflowNotification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkflowNotification_channel_dedupeKey_key" ON "WorkflowNotification"("channel", "dedupeKey");
CREATE INDEX "WorkflowTemplate_collectionId_status_idx" ON "WorkflowTemplate"("collectionId", "status");
CREATE INDEX "WorkflowStep_workflowTemplateId_sortOrder_idx" ON "WorkflowStep"("workflowTemplateId", "sortOrder");
CREATE INDEX "WorkflowRun_collectionId_status_idx" ON "WorkflowRun"("collectionId", "status");
CREATE INDEX "WorkflowRun_aquariumId_status_idx" ON "WorkflowRun"("aquariumId", "status");
CREATE INDEX "WorkflowStepRun_collectionId_status_dueAt_idx" ON "WorkflowStepRun"("collectionId", "status", "dueAt");
CREATE INDEX "WorkflowStepRun_workflowRunId_sortOrder_idx" ON "WorkflowStepRun"("workflowRunId", "sortOrder");
CREATE INDEX "WorkflowNotification_collectionId_status_scheduledFor_idx" ON "WorkflowNotification"("collectionId", "status", "scheduledFor");

ALTER TABLE "WorkflowTemplate" ADD CONSTRAINT "WorkflowTemplate_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowTemplate" ADD CONSTRAINT "WorkflowTemplate_defaultAquariumId_fkey" FOREIGN KEY ("defaultAquariumId") REFERENCES "Aquarium"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkflowTemplate" ADD CONSTRAINT "WorkflowTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkflowStepRun" ADD CONSTRAINT "WorkflowStepRun_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowStepRun" ADD CONSTRAINT "WorkflowStepRun_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkflowNotification" ADD CONSTRAINT "WorkflowNotification_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowNotification" ADD CONSTRAINT "WorkflowNotification_workflowRunId_fkey" FOREIGN KEY ("workflowRunId") REFERENCES "WorkflowRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowNotification" ADD CONSTRAINT "WorkflowNotification_workflowStepRunId_fkey" FOREIGN KEY ("workflowStepRunId") REFERENCES "WorkflowStepRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
