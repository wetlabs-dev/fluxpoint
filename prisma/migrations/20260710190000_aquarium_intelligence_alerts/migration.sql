ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'AQUARIUM_HEALTH_CRITICAL';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'AQUARIUM_HEALTH_CONCERN';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'AQUARIUM_PARAMETER_DRIFT';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'AQUARIUM_PARAMETER_INSTABILITY';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'AQUARIUM_INTELLIGENCE_FAILURE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'AQUARIUM_INTELLIGENCE_DIGEST';

ALTER TABLE "NotificationPreference" ADD COLUMN "aquariumHealthCriticalEmailEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "NotificationPreference" ADD COLUMN "aquariumHealthCriticalPushEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "NotificationPreference" ADD COLUMN "aquariumHealthConcernEmailEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "NotificationPreference" ADD COLUMN "aquariumHealthConcernPushEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "NotificationPreference" ADD COLUMN "aquariumParameterDriftEmailEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "NotificationPreference" ADD COLUMN "aquariumParameterDriftPushEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "NotificationPreference" ADD COLUMN "aquariumParameterInstabilityEmailEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "NotificationPreference" ADD COLUMN "aquariumParameterInstabilityPushEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "NotificationPreference" ADD COLUMN "aquariumIntelligenceFailureEmailEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "NotificationPreference" ADD COLUMN "aquariumIntelligenceFailurePushEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "NotificationPreference" ADD COLUMN "aquariumIntelligenceDigestEmailEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "NotificationPreference" ADD COLUMN "aquariumIntelligenceDigestPushEnabled" BOOLEAN NOT NULL DEFAULT false;
