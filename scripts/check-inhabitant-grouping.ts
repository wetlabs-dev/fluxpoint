import assert from "node:assert/strict";
import { groupAquariumInhabitants, describeInhabitantGroupForContext } from "../src/domains/aquariums/inhabitant-groups";

const base = {
  aquariumId: "tank-1",
  itemType: "FISH",
  unit: "fish",
  status: "IN_AQUARIUM",
  speciesDefinition: { commonName: "Pygmy Cory", scientificName: "Gastrodermus pygmaeus" }
};

const groups = groupAquariumInhabitants([
  { ...base, id: "old", name: "Pygmy Cory", quantity: 9, speciesDefinitionId: "cory", speciesVariantId: null, acquiredAt: new Date("2026-06-30T12:00:00Z"), source: { name: "House of Tropicals" } },
  { ...base, id: "new", name: "Pygmy Cory", quantity: 1, speciesDefinitionId: "cory", speciesVariantId: null, acquiredAt: new Date("2026-07-03T12:00:00Z"), source: { name: "House of Tropicals" }, notes: "replacement" },
  { ...base, id: "orange", name: "Orange Rili", quantity: 12, itemType: "INVERT", speciesDefinitionId: "neo", speciesVariantId: "orange", speciesVariant: { name: "Orange Rili" }, speciesDefinition: { commonName: "Neocaridina", scientificName: "Neocaridina davidi" } },
  { ...base, id: "blue", name: "Blue Dream", quantity: 10, itemType: "INVERT", speciesDefinitionId: "neo", speciesVariantId: "blue", speciesVariant: { name: "Blue Dream" }, speciesDefinition: { commonName: "Neocaridina", scientificName: "Neocaridina davidi" } },
  { ...base, id: "removed", name: "Pygmy Cory", quantity: 2, speciesDefinitionId: "cory", speciesVariantId: null, status: "REMOVED" }
]);

const pygmy = groups.find((group) => group.speciesDefinitionId === "cory" && group.status === "IN_AQUARIUM");
assert.ok(pygmy, "Active same-species batches should produce a grouped Pygmy Cory card.");
assert.equal(pygmy.totalQuantity, 10, "Grouped quantity should sum active batches.");
assert.equal(pygmy.batchCount, 2, "Grouped card should keep batch count.");
assert.equal(pygmy.primaryItem.id, "new", "Newest batch should be the default action target.");
assert.match(pygmy.dateSummary, /Jun 30, 2026.+Jul 3, 2026/, "Date summary should preserve the acquisition span.");
assert.match(describeInhabitantGroupForContext(pygmy), /10 fish across 2 batches/, "Eddy/stocking context should be concise and grouped.");

const removed = groups.find((group) => group.primaryItem.id === "removed");
assert.equal(removed?.totalQuantity, 2, "Removed records should not merge into active groups.");
assert.equal(groups.filter((group) => group.speciesDefinitionId === "neo").length, 2, "Different variants of the same species must stay separate.");

const customGroups = groupAquariumInhabitants([
  { id: "a", aquariumId: "tank-1", itemType: "OTHER", name: "Mystery hitchhiker", quantity: 1, unit: "item", status: "IN_AQUARIUM" },
  { id: "b", aquariumId: "tank-1", itemType: "OTHER", name: " mystery   hitchhiker ", quantity: 2, unit: "item", status: "IN_AQUARIUM" }
]);
assert.equal(customGroups.length, 1, "Clearly matching custom names should group safely.");
assert.equal(customGroups[0].totalQuantity, 3, "Custom-name groups should sum quantities.");

console.log("Aquarium inhabitant grouping checks passed.");
