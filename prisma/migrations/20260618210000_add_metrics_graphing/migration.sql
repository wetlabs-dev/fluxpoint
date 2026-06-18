-- CreateEnum
CREATE TYPE "MetricValueType" AS ENUM ('GAUGE', 'COUNTER');

-- CreateEnum
CREATE TYPE "MetricSource" AS ENUM ('MANUAL', 'SENSOR', 'API', 'IMPORTED');

-- CreateEnum
CREATE TYPE "GraphBackend" AS ENUM ('GRAFANA', 'NATIVE');

-- CreateEnum
CREATE TYPE "ManagedDashboardStatus" AS ENUM ('PENDING', 'SYNCED', 'FAILED', 'DISABLED');

-- CreateEnum
CREATE TYPE "MetricSyncStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "MetricDefinition" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "parameter" "WaterParameter",
    "unit" TEXT NOT NULL,
    "prometheusName" TEXT NOT NULL,
    "valueType" "MetricValueType" NOT NULL DEFAULT 'GAUGE',
    "defaultMin" DOUBLE PRECISION,
    "defaultMax" DOUBLE PRECISION,
    "enabledByDefault" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetricDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AquariumMetricConfig" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "aquariumId" TEXT NOT NULL,
    "metricDefinitionId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "minValue" DOUBLE PRECISION,
    "maxValue" DOUBLE PRECISION,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "source" "MetricSource" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AquariumMetricConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricLatestValue" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "aquariumId" TEXT NOT NULL,
    "metricDefinitionId" TEXT NOT NULL,
    "metricConfigId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "source" "MetricSource" NOT NULL DEFAULT 'API',
    "deviceId" TEXT,
    "sensorChannelId" TEXT,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetricLatestValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricIngestionToken" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "aquariumId" TEXT,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetricIngestionToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrafanaManagedDashboard" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "aquariumId" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "folderUid" TEXT,
    "status" "ManagedDashboardStatus" NOT NULL DEFAULT 'PENDING',
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GrafanaManagedDashboard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GraphPanel" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "aquariumId" TEXT NOT NULL,
    "metricConfigId" TEXT NOT NULL,
    "dashboardId" TEXT,
    "backend" "GraphBackend" NOT NULL DEFAULT 'GRAFANA',
    "panelId" INTEGER,
    "title" TEXT NOT NULL,
    "embedPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GraphPanel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricSyncLog" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT,
    "aquariumId" TEXT,
    "action" TEXT NOT NULL,
    "status" "MetricSyncStatus" NOT NULL,
    "message" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetricSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MetricDefinition_collectionId_enabledByDefault_idx" ON "MetricDefinition"("collectionId", "enabledByDefault");
CREATE UNIQUE INDEX "MetricDefinition_collectionId_key_key" ON "MetricDefinition"("collectionId", "key");

-- CreateIndex
CREATE INDEX "AquariumMetricConfig_collectionId_enabled_idx" ON "AquariumMetricConfig"("collectionId", "enabled");
CREATE INDEX "AquariumMetricConfig_metricDefinitionId_idx" ON "AquariumMetricConfig"("metricDefinitionId");
CREATE UNIQUE INDEX "AquariumMetricConfig_aquariumId_metricDefinitionId_key" ON "AquariumMetricConfig"("aquariumId", "metricDefinitionId");

-- CreateIndex
CREATE INDEX "MetricLatestValue_collectionId_aquariumId_idx" ON "MetricLatestValue"("collectionId", "aquariumId");
CREATE INDEX "MetricLatestValue_metricDefinitionId_idx" ON "MetricLatestValue"("metricDefinitionId");
CREATE INDEX "MetricLatestValue_measuredAt_idx" ON "MetricLatestValue"("measuredAt");
CREATE UNIQUE INDEX "MetricLatestValue_metricConfigId_key" ON "MetricLatestValue"("metricConfigId");

-- CreateIndex
CREATE UNIQUE INDEX "MetricIngestionToken_tokenHash_key" ON "MetricIngestionToken"("tokenHash");
CREATE INDEX "MetricIngestionToken_collectionId_aquariumId_idx" ON "MetricIngestionToken"("collectionId", "aquariumId");
CREATE INDEX "MetricIngestionToken_revokedAt_idx" ON "MetricIngestionToken"("revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "GrafanaManagedDashboard_uid_key" ON "GrafanaManagedDashboard"("uid");
CREATE UNIQUE INDEX "GrafanaManagedDashboard_aquariumId_key" ON "GrafanaManagedDashboard"("aquariumId");
CREATE INDEX "GrafanaManagedDashboard_collectionId_status_idx" ON "GrafanaManagedDashboard"("collectionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "GraphPanel_metricConfigId_backend_key" ON "GraphPanel"("metricConfigId", "backend");
CREATE INDEX "GraphPanel_collectionId_aquariumId_idx" ON "GraphPanel"("collectionId", "aquariumId");
CREATE INDEX "GraphPanel_dashboardId_idx" ON "GraphPanel"("dashboardId");

-- CreateIndex
CREATE INDEX "MetricSyncLog_collectionId_createdAt_idx" ON "MetricSyncLog"("collectionId", "createdAt");
CREATE INDEX "MetricSyncLog_aquariumId_createdAt_idx" ON "MetricSyncLog"("aquariumId", "createdAt");
CREATE INDEX "MetricSyncLog_status_createdAt_idx" ON "MetricSyncLog"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "MetricDefinition" ADD CONSTRAINT "MetricDefinition_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AquariumMetricConfig" ADD CONSTRAINT "AquariumMetricConfig_aquariumId_fkey" FOREIGN KEY ("aquariumId") REFERENCES "Aquarium"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AquariumMetricConfig" ADD CONSTRAINT "AquariumMetricConfig_metricDefinitionId_fkey" FOREIGN KEY ("metricDefinitionId") REFERENCES "MetricDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MetricLatestValue" ADD CONSTRAINT "MetricLatestValue_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MetricLatestValue" ADD CONSTRAINT "MetricLatestValue_aquariumId_fkey" FOREIGN KEY ("aquariumId") REFERENCES "Aquarium"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MetricLatestValue" ADD CONSTRAINT "MetricLatestValue_metricDefinitionId_fkey" FOREIGN KEY ("metricDefinitionId") REFERENCES "MetricDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MetricLatestValue" ADD CONSTRAINT "MetricLatestValue_metricConfigId_fkey" FOREIGN KEY ("metricConfigId") REFERENCES "AquariumMetricConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MetricIngestionToken" ADD CONSTRAINT "MetricIngestionToken_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MetricIngestionToken" ADD CONSTRAINT "MetricIngestionToken_aquariumId_fkey" FOREIGN KEY ("aquariumId") REFERENCES "Aquarium"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GrafanaManagedDashboard" ADD CONSTRAINT "GrafanaManagedDashboard_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GrafanaManagedDashboard" ADD CONSTRAINT "GrafanaManagedDashboard_aquariumId_fkey" FOREIGN KEY ("aquariumId") REFERENCES "Aquarium"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GraphPanel" ADD CONSTRAINT "GraphPanel_aquariumId_fkey" FOREIGN KEY ("aquariumId") REFERENCES "Aquarium"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GraphPanel" ADD CONSTRAINT "GraphPanel_metricConfigId_fkey" FOREIGN KEY ("metricConfigId") REFERENCES "AquariumMetricConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GraphPanel" ADD CONSTRAINT "GraphPanel_dashboardId_fkey" FOREIGN KEY ("dashboardId") REFERENCES "GrafanaManagedDashboard"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MetricSyncLog" ADD CONSTRAINT "MetricSyncLog_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
