import assert from "node:assert/strict";
import { mockSpeciesMagicFill, speciesMagicFillDraftSchema } from "../src/domains/species/species-magic-fill";
import { normalizeSpeciesAlias } from "../src/domains/species/aliases";

const corrected = mockSpeciesMagicFill({ category: "FISH", commonName: "Masked Julie", genus: "julidochromis", species: "marlieri" });
assert.equal(corrected.canonical.genus, "Julidochromis");
assert.equal(corrected.canonical.species, "transcriptus");
assert.equal(corrected.confidence, "MEDIUM");
assert.ok(corrected.warnings.some((warning) => warning.includes("marlieri")));
assert.equal(corrected.aliases[0]?.alias, "Masked Julii");
assert.doesNotThrow(() => speciesMagicFillDraftSchema.parse(corrected));

const conservative = mockSpeciesMagicFill({ category: "PLANT", commonName: "Mystery stem", genus: "rotala", species: "" });
assert.equal(conservative.confidence, "LOW");
assert.equal(conservative.canonical.genus, "Rotala");
assert.equal(conservative.profile.tempMin, null);
assert.equal(normalizeSpeciesAlias("  Masked   JULII  "), "masked julii");

console.log("Species Magic Fill checks passed.");
