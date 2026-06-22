ALTER TABLE "Aquarium"
  ADD COLUMN "targetSalinityMinPpt" DOUBLE PRECISION,
  ADD COLUMN "targetSalinityMaxPpt" DOUBLE PRECISION;

UPDATE "Aquarium"
SET
  "targetSalinityMinPpt" = CASE "salinity"::text WHEN 'FRESHWATER' THEN 0 WHEN 'BRACKISH' THEN 0.5 WHEN 'MARINE' THEN 30 END,
  "targetSalinityMaxPpt" = CASE "salinity"::text WHEN 'FRESHWATER' THEN 0.5 WHEN 'BRACKISH' THEN 30 WHEN 'MARINE' THEN 40 END;

ALTER TABLE "AquariumProfile"
  ADD COLUMN "targetTemperatureMin" DOUBLE PRECISION,
  ADD COLUMN "targetTemperatureMax" DOUBLE PRECISION,
  ADD COLUMN "targetPhMin" DOUBLE PRECISION,
  ADD COLUMN "targetPhMax" DOUBLE PRECISION,
  ADD COLUMN "targetGhMin" DOUBLE PRECISION,
  ADD COLUMN "targetGhMax" DOUBLE PRECISION,
  ADD COLUMN "targetKhMin" DOUBLE PRECISION,
  ADD COLUMN "targetKhMax" DOUBLE PRECISION,
  ADD COLUMN "targetAmmoniaMin" DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN "targetAmmoniaMax" DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN "targetNitriteMin" DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN "targetNitriteMax" DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN "targetNitrateMin" DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN "targetNitrateMax" DOUBLE PRECISION DEFAULT 40;

UPDATE "AquariumProfile"
SET
  "targetTemperatureMin" = CASE WHEN "targetTemperature" IS NULL THEN NULL ELSE "targetTemperature" - 2 END,
  "targetTemperatureMax" = CASE WHEN "targetTemperature" IS NULL THEN NULL ELSE "targetTemperature" + 2 END,
  "targetPhMin" = CASE WHEN "targetPh" IS NULL THEN NULL ELSE GREATEST(0, "targetPh" - 0.3) END,
  "targetPhMax" = CASE WHEN "targetPh" IS NULL THEN NULL ELSE "targetPh" + 0.3 END,
  "targetGhMin" = CASE WHEN "targetGh" IS NULL THEN NULL ELSE GREATEST(0, "targetGh" - 2) END,
  "targetGhMax" = CASE WHEN "targetGh" IS NULL THEN NULL ELSE "targetGh" + 2 END,
  "targetKhMin" = CASE WHEN "targetKh" IS NULL THEN NULL ELSE GREATEST(0, "targetKh" - 2) END,
  "targetKhMax" = CASE WHEN "targetKh" IS NULL THEN NULL ELSE "targetKh" + 2 END,
  "targetAmmoniaMin" = COALESCE("targetAmmoniaMin", 0),
  "targetAmmoniaMax" = COALESCE("targetAmmoniaMax", 0),
  "targetNitriteMin" = COALESCE("targetNitriteMin", 0),
  "targetNitriteMax" = COALESCE("targetNitriteMax", 0),
  "targetNitrateMin" = COALESCE("targetNitrateMin", 0),
  "targetNitrateMax" = COALESCE("targetNitrateMax", 40);

ALTER TABLE "AquariumMetricConfig" ADD COLUMN "thresholdOverride" BOOLEAN NOT NULL DEFAULT false;

UPDATE "AquariumMetricConfig" config
SET "thresholdOverride" = true
WHERE EXISTS (
  SELECT 1 FROM "AuditLog" audit
  WHERE audit."entityType" = 'AquariumMetricConfig'
    AND audit."entityId" = config.id
    AND audit.action = 'METRIC_THRESHOLD_CHANGED'
);

INSERT INTO "MetricDefinition" (id, "collectionId", key, "displayName", description, parameter, unit, "prometheusName", "valueType", "defaultMin", "defaultMax", "enabledByDefault", "createdAt", "updatedAt")
SELECT 'salinity_' || substr(md5(collection.id), 1, 20), collection.id, 'salinity_ppt', 'Salinity', 'Target and measured salinity in parts per thousand.', 'SALINITY', 'ppt', 'fluxpoint_aquarium_salinity_ppt', 'GAUGE', NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Collection" collection
ON CONFLICT ("collectionId", key) DO NOTHING;

INSERT INTO "AquariumMetricConfig" (id, "collectionId", "aquariumId", "metricDefinitionId", enabled, "minValue", "maxValue", "displayOrder", source, "thresholdOverride", "createdAt", "updatedAt")
SELECT 'salinity_cfg_' || substr(md5(aquarium.id), 1, 20), aquarium."collectionId", aquarium.id, definition.id, true, aquarium."targetSalinityMinPpt", aquarium."targetSalinityMaxPpt", 25, 'MANUAL', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Aquarium" aquarium
JOIN "MetricDefinition" definition ON definition."collectionId" = aquarium."collectionId" AND definition.key = 'salinity_ppt'
ON CONFLICT ("aquariumId", "metricDefinitionId") DO NOTHING;

UPDATE "AquariumMetricConfig" config
SET
  "minValue" = CASE definition.key
    WHEN 'temperature_f' THEN profile."targetTemperatureMin"
    WHEN 'ph' THEN profile."targetPhMin"
    WHEN 'ammonia_ppm' THEN COALESCE(profile."targetAmmoniaMin", 0)
    WHEN 'nitrite_ppm' THEN COALESCE(profile."targetNitriteMin", 0)
    WHEN 'nitrate_ppm' THEN COALESCE(profile."targetNitrateMin", 0)
    WHEN 'gh_dgh' THEN profile."targetGhMin"
    WHEN 'kh_dkh' THEN profile."targetKhMin"
    WHEN 'salinity_ppt' THEN aquarium."targetSalinityMinPpt"
    ELSE config."minValue" END,
  "maxValue" = CASE definition.key
    WHEN 'temperature_f' THEN profile."targetTemperatureMax"
    WHEN 'ph' THEN profile."targetPhMax"
    WHEN 'ammonia_ppm' THEN COALESCE(profile."targetAmmoniaMax", 0)
    WHEN 'nitrite_ppm' THEN COALESCE(profile."targetNitriteMax", 0)
    WHEN 'nitrate_ppm' THEN COALESCE(profile."targetNitrateMax", 40)
    WHEN 'gh_dgh' THEN profile."targetGhMax"
    WHEN 'kh_dkh' THEN profile."targetKhMax"
    WHEN 'salinity_ppt' THEN aquarium."targetSalinityMaxPpt"
    ELSE config."maxValue" END,
  "updatedAt" = CURRENT_TIMESTAMP
FROM "MetricDefinition" definition, "Aquarium" aquarium
LEFT JOIN "AquariumProfile" profile ON profile."aquariumId" = aquarium.id
WHERE config."metricDefinitionId" = definition.id
  AND config."aquariumId" = aquarium.id
  AND config."thresholdOverride" = false
  AND definition.key IN ('temperature_f', 'ph', 'ammonia_ppm', 'nitrite_ppm', 'nitrate_ppm', 'gh_dgh', 'kh_dkh', 'salinity_ppt');
