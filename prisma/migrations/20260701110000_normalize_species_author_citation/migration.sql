UPDATE "SpeciesDefinition"
SET "authorCitation" = substring(btrim("authorCitation") from 2 for char_length(btrim("authorCitation")) - 2)
WHERE "authorCitation" IS NOT NULL
  AND btrim("authorCitation") ~ '^\([^()]*\)$';
