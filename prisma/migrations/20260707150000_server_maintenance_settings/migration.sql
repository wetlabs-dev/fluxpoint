CREATE TABLE "ServerMaintenanceSettings" (
  "id" TEXT NOT NULL DEFAULT 'global',
  "diskWarningThresholdPercent" DOUBLE PRECISION NOT NULL DEFAULT 80,
  "diskCriticalThresholdPercent" DOUBLE PRECISION NOT NULL DEFAULT 90,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ServerMaintenanceSettings_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ServerMaintenanceSettings"
  ADD CONSTRAINT "ServerMaintenanceSettings_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
