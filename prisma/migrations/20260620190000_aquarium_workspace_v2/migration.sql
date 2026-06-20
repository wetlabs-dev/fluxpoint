CREATE TYPE "MedicationDoseType" AS ENUM ('ONE_OFF', 'TREATMENT_START', 'FOLLOW_UP', 'TREATMENT_COMPLETION');

ALTER TABLE "MedicationDefinition"
  ADD COLUMN "repeatIntervalHours" INTEGER,
  ADD COLUMN "courseLengthDays" INTEGER,
  ADD COLUMN "waterChangeGuidance" TEXT;

ALTER TABLE "MedicationDoseEvent"
  ADD COLUMN "recommendedDoseAmount" DOUBLE PRECISION,
  ADD COLUMN "recommendedDoseUnit" TEXT,
  ADD COLUMN "doseType" "MedicationDoseType" NOT NULL DEFAULT 'FOLLOW_UP';
