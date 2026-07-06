import assert from "node:assert/strict";
import {
  formatCollectionSummaryMarkdown,
  formatCollectionSummaryPlainText,
  formatTankSummaryMarkdown,
  formatTankSummaryPlainText,
  type CollectionTankSummaryData,
  type TankSummaryData
} from "../src/domains/summaries/tank-summary";

const generatedAt = new Date("2026-07-06T12:00:00Z");

const tank: TankSummaryData = {
  aquarium: {
    name: "Shaleshoal",
    status: "ACTIVE",
    salinity: "FRESHWATER",
    type: "DISPLAY",
    volume: "29 gal",
    location: "Family Room",
    dimensions: "30 x 12 x 18 in",
    estimatedVolume: "28 gal",
    description: "Nano fish planted tank.",
    updatedAt: generatedAt
  },
  waterTargets: ["Temperature: 74–78 °F", "pH: 6.8–7.4", "Water source: RODI remineralized"],
  inhabitants: {
    fish: [{ name: "Pygmy Cory", scientificName: "Gastordermus pygmaeus", quantity: 10, unit: "fish", batchCount: 2, status: "IN_AQUARIUM" }],
    inverts: [{ name: "Nerite snail", scientificName: null, quantity: 3, unit: "snails", batchCount: 1, status: "IN_AQUARIUM" }],
    plants: [{ name: "Java Fern", scientificName: "Microsorum pteropus", quantity: 4, unit: "plants", batchCount: 1, status: "IN_AQUARIUM" }],
    corals: [],
    other: []
  },
  equipment: {
    Filtration: ["Sponge filter"],
    Lighting: ["36 inch light (Nicrew ClassicLED)"]
  },
  lighting: ["36 inch light: Main Day · 5.25 full-output h · 6,300 lumen-hours"],
  conditions: ["Torn fin · Moderate · Watching"],
  emergencies: [],
  workflows: ["Weekly care · Running"],
  care: ["Water change · due Jul 7, 2026"],
  additionalContents: ["Hardscape: large driftwood cave (Rough confidence)"],
  missing: ["KH target is missing."],
  generatedAt
};

const plain = formatTankSummaryPlainText(tank, "detailed");
assert.ok(plain.includes("Pygmy Cory (Gastordermus pygmaeus) — 10 fish across 2 batches"));
assert.ok(plain.includes("Unstructured notes:"));
assert.ok(plain.includes("Sponge filter"));
assert.ok(!plain.includes("undefined"));

const markdown = formatTankSummaryMarkdown(tank, "standard");
assert.ok(markdown.includes("## Shaleshoal"));
assert.ok(markdown.includes("### Water targets"));
assert.ok(markdown.includes("- Fish: Pygmy Cory"));

const collection: CollectionTankSummaryData = {
  collection: {
    name: "Fluxpoint Keeper",
    tankCount: 1,
    totalVolumeGallons: 29,
    totalFish: 10,
    totalPlants: 4,
    totalOpenConditions: 1
  },
  tanks: [tank],
  generatedAt
};

const collectionPlain = formatCollectionSummaryPlainText(collection, "compact");
assert.ok(collectionPlain.includes("1 tank(s) · 29 total gal · 10 fish · 4 plants"));
assert.ok(collectionPlain.includes("Shaleshoal: Freshwater · Display"));

const collectionMarkdown = formatCollectionSummaryMarkdown(collection, "detailed");
assert.ok(collectionMarkdown.includes("# Fluxpoint Keeper"));
assert.ok(collectionMarkdown.includes("## Shaleshoal"));

console.log("Tank summary checks passed.");
