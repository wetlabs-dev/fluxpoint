import assert from "node:assert/strict";
import {
  displayNameForSpecies,
  getQuantityMin,
  getQuantityStep,
  normalizeQuantityInput,
  speciesMatchesItemType,
  speciesPickerLabel,
  unitAllowsDecimalQuantity
} from "../src/domains/inventory/quantity";
import { fishSexCountsAfterQuantityChange, formatFishSexBreakdown, normalizeFishSexCounts } from "../src/domains/inventory/fish-sex";

assert.equal(getQuantityStep("FISH"), "1");
assert.equal(getQuantityStep("INVERT"), "1");
assert.equal(getQuantityStep("PLANT"), "1");
assert.equal(getQuantityStep("EQUIPMENT"), "1");
assert.equal(getQuantityMin("FISH"), "1");
assert.equal(normalizeQuantityInput("6.4", "FISH"), 6);
assert.equal(normalizeQuantityInput("6.6", "INVERT"), 7);
assert.equal(unitAllowsDecimalQuantity("ml"), true);
assert.equal(getQuantityStep("ADDITIVE", "ml"), "0.01");
assert.equal(normalizeQuantityInput("2.5", "ADDITIVE", "ml"), 2.5);

assert.equal(speciesMatchesItemType("FISH", "FISH"), true);
assert.equal(speciesMatchesItemType("FISH", "PLANT"), false);
assert.equal(speciesMatchesItemType("PLANT", "PLANT"), true);
assert.equal(speciesMatchesItemType("INVERT", "INVERT"), true);
assert.equal(speciesMatchesItemType("EQUIPMENT", "FISH"), false);
assert.equal(speciesMatchesItemType("OTHER", "CORAL", { tankInhabitant: true }), true);
assert.equal(speciesMatchesItemType("OTHER", "CORAL"), false);

assert.equal(speciesPickerLabel("FISH"), "Select fish species");
assert.equal(speciesPickerLabel("PLANT"), "Select plant species");
assert.equal(displayNameForSpecies({ commonName: "Java fern", scientificName: "Microsorum pteropus" }), "Java fern");
assert.equal(displayNameForSpecies({ commonName: "", scientificName: "Microsorum pteropus" }), "Microsorum pteropus");
assert.equal(displayNameForSpecies({ commonName: "", scientificName: "", genus: "Microsorum", species: "pteropus" }), "Microsorum pteropus");

assert.deepEqual(normalizeFishSexCounts({ itemType: "FISH", quantity: 6, maleCountApprox: "2", femaleCountApprox: "3" }), { maleCountApprox: 2, femaleCountApprox: 3 });
assert.equal(formatFishSexBreakdown({ itemType: "FISH", quantity: 6, maleCountApprox: 2, femaleCountApprox: 3 }), "2 male · 3 female · 1 unsexed");
assert.deepEqual(fishSexCountsAfterQuantityChange({ itemType: "FISH", quantity: 3, maleCountApprox: 2, femaleCountApprox: 3 }), { maleCountApprox: null, femaleCountApprox: null });
assert.throws(() => normalizeFishSexCounts({ itemType: "FISH", quantity: 2, maleCountApprox: "2", femaleCountApprox: "1" }), /cannot exceed/);
assert.deepEqual(normalizeFishSexCounts({ itemType: "PLANT", quantity: 2, maleCountApprox: "2", femaleCountApprox: "1" }), { maleCountApprox: null, femaleCountApprox: null });

console.log("Inventory usability checks passed.");
