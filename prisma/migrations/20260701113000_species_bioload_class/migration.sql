CREATE TYPE "SpeciesBioloadClass" AS ENUM ('NEGLIGIBLE', 'LOW', 'MODERATE', 'HIGH', 'EXTREME');

ALTER TABLE "SpeciesDefinition" ADD COLUMN "bioloadClass" "SpeciesBioloadClass";
