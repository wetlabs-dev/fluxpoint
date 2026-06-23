import assert from "node:assert/strict";
import { mockSpeciesMagicFill, speciesMagicFillDraftSchema } from "../src/domains/species/species-magic-fill";
import { normalizeSpeciesAlias } from "../src/domains/species/aliases";

const corrected = mockSpeciesMagicFill({ category: "FISH", commonName: "Masked Julie", genus: "julidochromis", species: "marlieri" });
assert.equal(corrected.canonical.genus, "Julidochromis");
assert.equal(corrected.canonical.species, "transcriptus");
assert.equal(corrected.confidence, "MEDIUM");
assert.ok(corrected.warnings.some((warning) => warning.includes("marlieri")));
assert.equal(corrected.aliases[0]?.alias, "Masked Julii");
assert.equal(corrected.salinityMinPpt, 0);
assert.equal(corrected.salinityMaxPpt, 0.5);
assert.deepEqual(corrected.references, { authorCitation: null, wikipediaUrl: null, inaturalistUrl: null, powoUrl: null, gbifUrl: null });
assert.doesNotThrow(() => speciesMagicFillDraftSchema.parse(corrected));

const conservative = mockSpeciesMagicFill({ category: "PLANT", commonName: "Mystery stem", genus: "rotala", species: "" });
assert.equal(conservative.confidence, "LOW");
assert.equal(conservative.canonical.genus, "Rotala");
assert.equal(conservative.profile.tempMin, null);
assert.equal(conservative.salinityMinPpt, null);
assert.equal(normalizeSpeciesAlias("  Masked   JULII  "), "masked julii");

const javaFern = mockSpeciesMagicFill({ category: "PLANT", commonName: "Java fern" });
assert.equal(javaFern.canonical.category, "PLANT");
assert.equal(javaFern.canonical.commonName, "Java Fern");
assert.equal(javaFern.canonical.genus, "Microsorum");
assert.equal(javaFern.profile.growthRate, "Slow");
assert.equal(javaFern.salinityMinPpt, 0);
assert.equal(javaFern.references.powoUrl, null);
const preservedReference = mockSpeciesMagicFill({ category: "PLANT", commonName: "Mystery stem", wikipediaUrl: "https://example.org/taxon" });
assert.equal(preservedReference.references.wikipediaUrl, "https://example.org/taxon");
const rejectedReference = mockSpeciesMagicFill({ category: "PLANT", commonName: "Mystery stem", wikipediaUrl: "not-a-url" });
assert.equal(rejectedReference.references.wikipediaUrl, null);
for (const category of ["INVERT", "CORAL", "OTHER"] as const) {
  const draft = mockSpeciesMagicFill({ category, commonName: `Test ${category.toLowerCase()}` });
  assert.equal(draft.canonical.category, category);
}

console.log("Species Magic Fill checks passed.");
