CREATE TYPE "NotificationType" AS ENUM ('CARE_REMINDER', 'MAINTENANCE_REMINDER', 'MEDICATION_REMINDER', 'QUARANTINE_REMINDER', 'WATER_TEST_REMINDER', 'METRIC_THRESHOLD_ALERT', 'SERVER_HEALTH_ALERT', 'EDDY_DIGEST', 'TEST_PUSH');
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'PUSH');
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

CREATE TABLE "NotificationPreference" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
  "quietHoursStart" TEXT,
  "quietHoursEnd" TEXT,
  "careEmailEnabled" BOOLEAN NOT NULL DEFAULT true,
  "carePushEnabled" BOOLEAN NOT NULL DEFAULT false,
  "maintenanceEmailEnabled" BOOLEAN NOT NULL DEFAULT true,
  "maintenancePushEnabled" BOOLEAN NOT NULL DEFAULT false,
  "medicationEmailEnabled" BOOLEAN NOT NULL DEFAULT true,
  "medicationPushEnabled" BOOLEAN NOT NULL DEFAULT false,
  "quarantineEmailEnabled" BOOLEAN NOT NULL DEFAULT true,
  "quarantinePushEnabled" BOOLEAN NOT NULL DEFAULT false,
  "waterTestEmailEnabled" BOOLEAN NOT NULL DEFAULT true,
  "waterTestPushEnabled" BOOLEAN NOT NULL DEFAULT false,
  "metricThresholdEmailEnabled" BOOLEAN NOT NULL DEFAULT true,
  "metricThresholdPushEnabled" BOOLEAN NOT NULL DEFAULT false,
  "serverHealthEmailEnabled" BOOLEAN NOT NULL DEFAULT true,
  "serverHealthPushEnabled" BOOLEAN NOT NULL DEFAULT false,
  "eddyDigestEmailEnabled" BOOLEAN NOT NULL DEFAULT false,
  "eddyDigestPushEnabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PushSubscription" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "userAgent" TEXT,
  "deviceLabel" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "lastSeenAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "failureCount" INTEGER NOT NULL DEFAULT 0,
  "lastFailureAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationDelivery" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "collectionId" TEXT,
  "type" "NotificationType" NOT NULL,
  "channel" "NotificationChannel" NOT NULL,
  "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "dedupeKey" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "recipient" TEXT,
  "provider" TEXT,
  "providerId" TEXT,
  "entityType" TEXT,
  "entityId" TEXT,
  "error" TEXT,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "NotificationPreference"("userId");
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX "PushSubscription_userId_enabled_idx" ON "PushSubscription"("userId", "enabled");
CREATE INDEX "PushSubscription_revokedAt_idx" ON "PushSubscription"("revokedAt");
CREATE INDEX "PushSubscription_lastSeenAt_idx" ON "PushSubscription"("lastSeenAt");
CREATE UNIQUE INDEX "NotificationDelivery_userId_channel_dedupeKey_key" ON "NotificationDelivery"("userId", "channel", "dedupeKey");
CREATE INDEX "NotificationDelivery_status_createdAt_idx" ON "NotificationDelivery"("status", "createdAt");
CREATE INDEX "NotificationDelivery_type_createdAt_idx" ON "NotificationDelivery"("type", "createdAt");
CREATE INDEX "NotificationDelivery_collectionId_createdAt_idx" ON "NotificationDelivery"("collectionId", "createdAt");

ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
