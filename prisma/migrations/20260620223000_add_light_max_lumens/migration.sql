ALTER TABLE "EquipmentProfile" ADD COLUMN "maxLumens" INTEGER;
ALTER TABLE "EquipmentProfile" ADD CONSTRAINT "EquipmentProfile_maxLumens_check" CHECK ("maxLumens" IS NULL OR ("maxLumens" > 0 AND "maxLumens" < 1000000));
