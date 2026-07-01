-- Move structured TDS range storage from husbandry guide JSON into SpeciesDefinition.
-- Existing husbandry JSON is intentionally preserved for audit/history, but the app
-- no longer surfaces husbandry tdsRange in forms or Magic Fill.
ALTER TABLE "SpeciesDefinition"
  ADD COLUMN "tdsMin" DOUBLE PRECISION,
  ADD COLUMN "tdsMax" DOUBLE PRECISION;

WITH parsed_tds AS (
  SELECT
    g."speciesDefinitionId",
    regexp_match(g."fields"->>'tdsRange', '([0-9]+(?:\.[0-9]+)?)\D+([0-9]+(?:\.[0-9]+)?)') AS range_match
  FROM "SpeciesHusbandryGuide" g
  WHERE g."fields" ? 'tdsRange'
    AND NULLIF(btrim(g."fields"->>'tdsRange'), '') IS NOT NULL
)
UPDATE "SpeciesDefinition" s
SET
  "tdsMin" = COALESCE(s."tdsMin", LEAST((p.range_match)[1]::double precision, (p.range_match)[2]::double precision)),
  "tdsMax" = COALESCE(s."tdsMax", GREATEST((p.range_match)[1]::double precision, (p.range_match)[2]::double precision))
FROM parsed_tds p
WHERE s.id = p."speciesDefinitionId"
  AND p.range_match IS NOT NULL
  AND (s."tdsMin" IS NULL OR s."tdsMax" IS NULL);
