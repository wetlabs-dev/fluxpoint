ALTER TABLE "WaterChangeEvent"
  ADD COLUMN "beforeNotes" TEXT,
  ADD COLUMN "afterNotes" TEXT,
  ADD COLUMN "parameterNotes" TEXT;

ALTER TABLE "FeedingEvent" ADD COLUMN "targetItemId" TEXT;

CREATE INDEX "FeedingEvent_targetItemId_idx" ON "FeedingEvent"("targetItemId");

ALTER TABLE "FeedingEvent"
  ADD CONSTRAINT "FeedingEvent_targetItemId_fkey"
  FOREIGN KEY ("targetItemId") REFERENCES "AquariumItem"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
