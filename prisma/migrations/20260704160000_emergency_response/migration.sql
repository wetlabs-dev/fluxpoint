-- Emergency Response module
CREATE TYPE "EmergencyType" AS ENUM (
  'POWER_OUTAGE',
  'TANK_LEAK',
  'TANK_BREAK',
  'FILTER_FAILURE',
  'HEATER_FAILURE',
  'CHILLER_FAILURE',
  'AIR_PUMP_FAILURE',
  'CO2_OVERDOSE',
  'OXYGEN_CRASH',
  'AMMONIA_SPIKE',
  'NITRITE_SPIKE',
  'TEMPERATURE_SPIKE',
  'TEMPERATURE_DROP',
  'CONTAMINATION',
  'DISEASE_OUTBREAK',
  'FLOOD',
  'OTHER'
);

CREATE TYPE "EmergencySeverity" AS ENUM ('LOW', 'MODERATE', 'HIGH', 'CRITICAL');
CREATE TYPE "EmergencyIncidentStatus" AS ENUM ('ACTIVE', 'STABILIZING', 'RECOVERING', 'VERIFYING', 'RESOLVED', 'CANCELLED');
CREATE TYPE "EmergencyPhase" AS ENUM ('IMMEDIATE', 'STABILIZATION', 'RECOVERY', 'VERIFICATION');
CREATE TYPE "EmergencyStepStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE', 'SKIPPED');
CREATE TYPE "EmergencyLogType" AS ENUM ('NOTE', 'ACTION', 'METRIC', 'PHOTO', 'STATUS_CHANGE', 'EQUIPMENT', 'LOSS', 'RECOVERY_CHECK');

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'EMERGENCY_RESPONSE';
ALTER TABLE "NotificationPreference" ADD COLUMN "emergencyResponseEmailEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "NotificationPreference" ADD COLUMN "emergencyResponsePushEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "EmergencyPlan" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "emergencyType" "EmergencyType" NOT NULL DEFAULT 'OTHER',
  "severityDefault" "EmergencySeverity" NOT NULL DEFAULT 'MODERATE',
  "description" TEXT,
  "immediateSteps" JSONB NOT NULL,
  "stabilizationSteps" JSONB NOT NULL,
  "recoverySteps" JSONB NOT NULL,
  "verificationSteps" JSONB NOT NULL,
  "supplies" JSONB,
  "notes" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmergencyPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmergencyIncident" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "emergencyPlanId" TEXT,
  "title" TEXT NOT NULL,
  "emergencyType" "EmergencyType" NOT NULL DEFAULT 'OTHER',
  "severity" "EmergencySeverity" NOT NULL DEFAULT 'MODERATE',
  "status" "EmergencyIncidentStatus" NOT NULL DEFAULT 'ACTIVE',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "stabilizedAt" TIMESTAMP(3),
  "recoveryStartedAt" TIMESTAMP(3),
  "verificationStartedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "summary" TEXT,
  "rootCause" TEXT,
  "outcomeNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmergencyIncident_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmergencyIncidentAquarium" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "incidentId" TEXT NOT NULL,
  "aquariumId" TEXT NOT NULL,
  "severity" "EmergencySeverity",
  "status" "EmergencyIncidentStatus",
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmergencyIncidentAquarium_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmergencyIncidentStep" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "incidentId" TEXT NOT NULL,
  "phase" "EmergencyPhase" NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "EmergencyStepStatus" NOT NULL DEFAULT 'PENDING',
  "dueAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "completedById" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmergencyIncidentStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmergencyIncidentLog" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "incidentId" TEXT NOT NULL,
  "aquariumId" TEXT,
  "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "logType" "EmergencyLogType" NOT NULL DEFAULT 'NOTE',
  "message" TEXT NOT NULL,
  "metadata" JSONB,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmergencyIncidentLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CareTask" ADD COLUMN "emergencyIncidentStepId" TEXT;

CREATE UNIQUE INDEX "EmergencyIncidentAquarium_incidentId_aquariumId_key" ON "EmergencyIncidentAquarium"("incidentId", "aquariumId");
CREATE UNIQUE INDEX "CareTask_emergencyIncidentStepId_key" ON "CareTask"("emergencyIncidentStepId");
CREATE INDEX "EmergencyPlan_collectionId_isActive_emergencyType_idx" ON "EmergencyPlan"("collectionId", "isActive", "emergencyType");
CREATE INDEX "EmergencyPlan_createdById_idx" ON "EmergencyPlan"("createdById");
CREATE INDEX "EmergencyIncident_collectionId_status_severity_idx" ON "EmergencyIncident"("collectionId", "status", "severity");
CREATE INDEX "EmergencyIncident_collectionId_startedAt_idx" ON "EmergencyIncident"("collectionId", "startedAt");
CREATE INDEX "EmergencyIncident_emergencyPlanId_idx" ON "EmergencyIncident"("emergencyPlanId");
CREATE INDEX "EmergencyIncident_createdById_idx" ON "EmergencyIncident"("createdById");
CREATE INDEX "EmergencyIncidentAquarium_collectionId_aquariumId_idx" ON "EmergencyIncidentAquarium"("collectionId", "aquariumId");
CREATE INDEX "EmergencyIncidentAquarium_incidentId_idx" ON "EmergencyIncidentAquarium"("incidentId");
CREATE INDEX "EmergencyIncidentStep_collectionId_incidentId_phase_sortOrder_idx" ON "EmergencyIncidentStep"("collectionId", "incidentId", "phase", "sortOrder");
CREATE INDEX "EmergencyIncidentStep_status_dueAt_idx" ON "EmergencyIncidentStep"("status", "dueAt");
CREATE INDEX "EmergencyIncidentStep_completedById_idx" ON "EmergencyIncidentStep"("completedById");
CREATE INDEX "EmergencyIncidentLog_collectionId_incidentId_loggedAt_idx" ON "EmergencyIncidentLog"("collectionId", "incidentId", "loggedAt");
CREATE INDEX "EmergencyIncidentLog_aquariumId_loggedAt_idx" ON "EmergencyIncidentLog"("aquariumId", "loggedAt");
CREATE INDEX "EmergencyIncidentLog_logType_loggedAt_idx" ON "EmergencyIncidentLog"("logType", "loggedAt");
CREATE INDEX "EmergencyIncidentLog_createdById_idx" ON "EmergencyIncidentLog"("createdById");
CREATE INDEX "CareTask_emergencyIncidentStepId_idx" ON "CareTask"("emergencyIncidentStepId");

ALTER TABLE "EmergencyPlan" ADD CONSTRAINT "EmergencyPlan_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmergencyPlan" ADD CONSTRAINT "EmergencyPlan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmergencyIncident" ADD CONSTRAINT "EmergencyIncident_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmergencyIncident" ADD CONSTRAINT "EmergencyIncident_emergencyPlanId_fkey" FOREIGN KEY ("emergencyPlanId") REFERENCES "EmergencyPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmergencyIncident" ADD CONSTRAINT "EmergencyIncident_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmergencyIncidentAquarium" ADD CONSTRAINT "EmergencyIncidentAquarium_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmergencyIncidentAquarium" ADD CONSTRAINT "EmergencyIncidentAquarium_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "EmergencyIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmergencyIncidentAquarium" ADD CONSTRAINT "EmergencyIncidentAquarium_aquariumId_fkey" FOREIGN KEY ("aquariumId") REFERENCES "Aquarium"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmergencyIncidentStep" ADD CONSTRAINT "EmergencyIncidentStep_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmergencyIncidentStep" ADD CONSTRAINT "EmergencyIncidentStep_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "EmergencyIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmergencyIncidentStep" ADD CONSTRAINT "EmergencyIncidentStep_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmergencyIncidentLog" ADD CONSTRAINT "EmergencyIncidentLog_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmergencyIncidentLog" ADD CONSTRAINT "EmergencyIncidentLog_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "EmergencyIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmergencyIncidentLog" ADD CONSTRAINT "EmergencyIncidentLog_aquariumId_fkey" FOREIGN KEY ("aquariumId") REFERENCES "Aquarium"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmergencyIncidentLog" ADD CONSTRAINT "EmergencyIncidentLog_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CareTask" ADD CONSTRAINT "CareTask_emergencyIncidentStepId_fkey" FOREIGN KEY ("emergencyIncidentStepId") REFERENCES "EmergencyIncidentStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;
