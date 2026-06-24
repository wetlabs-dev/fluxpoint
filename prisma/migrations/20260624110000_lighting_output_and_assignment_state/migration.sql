CREATE TYPE "LightOutputEstimateMethod" AS ENUM ('LUMENS', 'WATTAGE_ESTIMATED', 'UNKNOWN');

ALTER TABLE "EquipmentProfile"
  ADD COLUMN "wattage" DOUBLE PRECISION,
  ADD COLUMN "outputEstimateMethod" "LightOutputEstimateMethod" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "efficacyLumensPerWatt" DOUBLE PRECISION;

ALTER TABLE "EquipmentProfile"
  ADD CONSTRAINT "EquipmentProfile_wattage_check" CHECK ("wattage" IS NULL OR ("wattage" > 0 AND "wattage" <= 100000)),
  ADD CONSTRAINT "EquipmentProfile_efficacy_check" CHECK ("efficacyLumensPerWatt" IS NULL OR ("efficacyLumensPerWatt" > 0 AND "efficacyLumensPerWatt" <= 1000));

UPDATE "EquipmentProfile"
SET "outputEstimateMethod" = CASE
  WHEN "maxLumens" IS NOT NULL THEN 'LUMENS'::"LightOutputEstimateMethod"
  ELSE 'UNKNOWN'::"LightOutputEstimateMethod"
END
WHERE "equipmentType" = 'LIGHT';

ALTER TABLE "AquariumLightingAssignment"
  ADD COLUMN "enabled" BOOLEAN NOT NULL DEFAULT true;
