-- Odds-and-ends refinement pass:
-- - track approximate fish sex counts on inventory groups
-- - store keeper-facing maximum fish size on species definitions
ALTER TABLE "SpeciesDefinition" ADD COLUMN "maxSize" TEXT;

ALTER TABLE "AquariumItem" ADD COLUMN "maleCountApprox" INTEGER;
ALTER TABLE "AquariumItem" ADD COLUMN "femaleCountApprox" INTEGER;
