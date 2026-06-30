ALTER TABLE "LightingSchedule" ADD COLUMN "rampMinutes" INTEGER NOT NULL DEFAULT 30;

UPDATE "LightingSchedule" AS s
SET "rampMinutes" = COALESCE(
  (
    SELECT p."rampMinutes"
    FROM "LightingSchedulePoint" AS p
    WHERE p."scheduleId" = s."id"
      AND p."rampMinutes" > 0
    ORDER BY p."sortOrder" ASC
    LIMIT 1
  ),
  (
    SELECT p."rampMinutes"
    FROM "LightingSchedulePoint" AS p
    WHERE p."scheduleId" = s."id"
    ORDER BY p."sortOrder" ASC
    LIMIT 1
  ),
  30
);
