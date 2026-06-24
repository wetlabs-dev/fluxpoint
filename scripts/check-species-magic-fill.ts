import assert from "node:assert/strict";
import { mockSpeciesMagicFill, speciesMagicFillDraftSchema, speciesMagicFillInstructions } from "../src/domains/species/species-magic-fill";
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
assert.equal(javaFern.references.authorCitation, "(Blume) Copel.");
assert.equal(javaFern.references.gbifUrl, "https://www.gbif.org/species/7289955");
assert.equal(javaFern.aliases[0]?.alias, "Leptochilus pteropus");
assert.equal(javaFern.aliases[0]?.source, "GBIF Backbone Taxonomy");
assert.equal(javaFern.profile.growthRate, "Slow");
assert.equal(javaFern.salinityMinPpt, 0);
assert.ok(javaFern.profile.tempMin != null);

const categoryCorrection = mockSpeciesMagicFill({ category: "FISH", commonName: "Java fern" });
assert.equal(categoryCorrection.canonical.category, "PLANT");
assert.ok(categoryCorrection.warnings.some((warning) => warning.includes("selected category is fish")));

const zebraObliquidens = mockSpeciesMagicFill({ category: "FISH", commonName: "Zebra obliquidens" });
assert.equal(zebraObliquidens.canonical.genus, "Astatotilapia");
assert.equal(zebraObliquidens.references.authorCitation, "(Regan, 1929)");
assert.equal(zebraObliquidens.references.gbifUrl, "https://www.gbif.org/species/2373362");
assert.equal(zebraObliquidens.aliases[0]?.alias, "Haplochromis latifasciatus");
assert.equal(zebraObliquidens.salinityMinPpt, 0);
assert.ok(zebraObliquidens.profile.tempMin != null);
assert.ok(zebraObliquidens.profile.breedingNotes);
assert.doesNotThrow(() => speciesMagicFillDraftSchema.parse(zebraObliquidens));

for (const field of ["authorCitation", "wikipediaUrl", "inaturalistUrl", "powoUrl", "gbifUrl", "salinityMinPpt", "salinityMaxPpt", "preferredHardness", "flowRequirement", "breedingNotes", "regionalStatus"]) {
  assert.ok(speciesMagicFillInstructions.includes(field), `Magic Fill instructions should explicitly request ${field}`);
}
assert.ok(speciesMagicFillInstructions.includes("complete species definition"));
assert.ok(speciesMagicFillInstructions.includes("Continue through all field groups"));
const preservedReference = mockSpeciesMagicFill({ category: "PLANT", commonName: "Mystery stem", wikipediaUrl: "https://example.org/taxon" });
assert.equal(preservedReference.references.wikipediaUrl, "https://example.org/taxon");
const rejectedReference = mockSpeciesMagicFill({ category: "PLANT", commonName: "Mystery stem", wikipediaUrl: "not-a-url" });
assert.equal(rejectedReference.references.wikipediaUrl, null);
for (const category of ["INVERT", "CORAL", "OTHER"] as const) {
  const draft = mockSpeciesMagicFill({ category, commonName: `Test ${category.toLowerCase()}` });
  assert.equal(draft.canonical.category, category);
}

console.log("Species Magic Fill checks passed.");
