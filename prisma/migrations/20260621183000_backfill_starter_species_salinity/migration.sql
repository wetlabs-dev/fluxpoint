UPDATE "SpeciesDefinition"
SET "salinityMin" = 0, "salinityMax" = 0.5
WHERE "scientificName" IN ('Hyphessobrycon amandae', 'Microsorum pteropus', 'Caridina multidentata')
  AND "salinityMin" IS NULL
  AND "salinityMax" IS NULL;
