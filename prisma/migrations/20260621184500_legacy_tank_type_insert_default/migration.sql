-- The column is intentionally retained for rolling-deploy safety but is no longer mapped by
-- Prisma. A default lets the new application insert aquariums without driving legacy data.
ALTER TABLE "Aquarium" ALTER COLUMN "tankType" SET DEFAULT 'FRESHWATER';
