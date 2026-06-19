CREATE TYPE "AiRateLimitWindowType" AS ENUM ('DAILY', 'MONTHLY');

ALTER TABLE "AiRequestLog"
  ADD COLUMN "featureKey" TEXT,
  ADD COLUMN "providerAttempted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "imageCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "AiRateLimitUsage" (
  "id" TEXT NOT NULL,
  "scopeKey" TEXT NOT NULL,
  "collectionId" TEXT,
  "userId" TEXT,
  "featureKey" TEXT NOT NULL,
  "windowType" "AiRateLimitWindowType" NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiRateLimitUsage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiRateLimitOverride" (
  "id" TEXT NOT NULL,
  "scopeKey" TEXT NOT NULL,
  "collectionId" TEXT,
  "userId" TEXT,
  "featureKey" TEXT NOT NULL,
  "dailyUserLimit" INTEGER,
  "dailyCollectionLimit" INTEGER,
  "monthlyCollectionLimit" INTEGER,
  "enabled" BOOLEAN,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiRateLimitOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiRateLimitUsage_scopeKey_featureKey_windowType_windowStart_key" ON "AiRateLimitUsage"("scopeKey", "featureKey", "windowType", "windowStart");
CREATE INDEX "AiRateLimitUsage_collectionId_windowStart_idx" ON "AiRateLimitUsage"("collectionId", "windowStart");
CREATE INDEX "AiRateLimitUsage_userId_windowStart_idx" ON "AiRateLimitUsage"("userId", "windowStart");
CREATE INDEX "AiRateLimitUsage_featureKey_windowStart_idx" ON "AiRateLimitUsage"("featureKey", "windowStart");
CREATE UNIQUE INDEX "AiRateLimitOverride_scopeKey_featureKey_key" ON "AiRateLimitOverride"("scopeKey", "featureKey");
CREATE INDEX "AiRateLimitOverride_collectionId_idx" ON "AiRateLimitOverride"("collectionId");
CREATE INDEX "AiRateLimitOverride_userId_idx" ON "AiRateLimitOverride"("userId");
CREATE INDEX "AiRequestLog_featureKey_createdAt_idx" ON "AiRequestLog"("featureKey", "createdAt");

ALTER TABLE "AiRateLimitUsage" ADD CONSTRAINT "AiRateLimitUsage_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiRateLimitUsage" ADD CONSTRAINT "AiRateLimitUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiRateLimitOverride" ADD CONSTRAINT "AiRateLimitOverride_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiRateLimitOverride" ADD CONSTRAINT "AiRateLimitOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
