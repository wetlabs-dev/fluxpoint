CREATE TYPE "Co2Requirement" AS ENUM ('REQUIRED', 'RECOMMENDED', 'NOT_NEEDED', 'UNKNOWN');

ALTER TABLE "SpeciesDefinition"
  ADD COLUMN "co2Requirement" "Co2Requirement" NOT NULL DEFAULT 'UNKNOWN';

UPDATE "SpeciesDefinition"
SET "co2Requirement" = CASE
  WHEN "category" = 'PLANT' AND "co2Preference" ~* '(required|demanding|high tech|high-tech)' THEN 'REQUIRED'::"Co2Requirement"
  WHEN "category" = 'PLANT' AND "co2Preference" ~* '(recommend|benefit|benefits|pressurized|supplement)' THEN 'RECOMMENDED'::"Co2Requirement"
  WHEN "category" = 'PLANT' AND "co2Preference" ~* '(not required|not needed|none|low tech|low-tech|no co2)' THEN 'NOT_NEEDED'::"Co2Requirement"
  ELSE 'UNKNOWN'::"Co2Requirement"
END;
