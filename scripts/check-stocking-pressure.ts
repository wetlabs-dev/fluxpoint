import assert from "node:assert/strict";
import { buildAquariumStockingPressureFingerprint, derivePreliminaryStockingPressureFlags, isStockingItemIncluded, mockAquariumStockingPressure, type StockingPressureContext } from "../src/domains/aquariums/stocking-pressure";

function context(patch: Partial<StockingPressureContext> = {}): StockingPressureContext {
  return {
    aquarium: { id: "tank", name: "Test tank", volume: 10, volumeUnit: "GALLON", volumeGallons: 10, dimensionsInches: [20, 10, 12], aquariumType: "DISPLAY", targetSalinityPpt: [0, 0.5], status: "ACTIVE" },
    stocking: [],
    filtration: [{ attachmentId: "filter-attachment", itemId: "filter", name: "Nano filter", role: "FILTER", equipmentType: "FILTER", brand: "Test", model: "10", notes: "Low-flow shrimp filter", attachmentNotes: null }],
    legacyFiltration: null,
    latestNitrogenReadings: [],
    ...patch
  };
}

const plantedShrimp = context({
  stocking: [
    { itemId: "shrimp", itemType: "INVERT", name: "Cherry shrimp", quantity: 30, status: "IN_AQUARIUM", notes: null, species: { id: "neocaridina", category: "INVERT", commonName: "Cherry Shrimp", scientificName: "Neocaridina davidi", maxSize: null, bioloadClass: "NEGLIGIBLE", maxHeight: null, notes: null, careNotes: "Small freshwater shrimp.", husbandryFields: null } },
    { itemId: "fern", itemType: "PLANT", name: "Java fern", quantity: 10, status: "IN_AQUARIUM", notes: null, species: { id: "java-fern", category: "PLANT", commonName: "Java Fern", scientificName: "Microsorum pteropus", maxSize: null, bioloadClass: null, maxHeight: 12, notes: null, careNotes: null, husbandryFields: null } }
  ]
});
const shrimpDraft = mockAquariumStockingPressure(plantedShrimp);
assert.equal(shrimpDraft.level, "VERY_LIGHT");
assert.equal(shrimpDraft.confidence, "HIGH");
assert.ok(shrimpDraft.flags.includes("SHRIMP_DOMINANT"));
assert.ok(shrimpDraft.flags.includes("PLANT_ASSISTED") || shrimpDraft.flags.includes("HIGH_PLANT_MASS"));

const livebearers = context({
  aquarium: { ...context().aquarium, volume: 20, volumeGallons: 20 },
  filtration: [],
  stocking: [{ itemId: "platies", itemType: "FISH", name: "Platies", quantity: 20, status: "IN_AQUARIUM", notes: "Young livebearer group", species: { id: "platy", category: "FISH", commonName: "Platy", scientificName: "Xiphophorus maculatus", maxSize: "2.5 inches", bioloadClass: "MODERATE", maxHeight: null, notes: "Adult size 2.5 inches.", careNotes: null, husbandryFields: null } }]
});
const livebearerDraft = mockAquariumStockingPressure(livebearers);
assert.ok(["HEAVY", "OVERSTOCKED"].includes(livebearerDraft.level));
assert.ok(livebearerDraft.flags.includes("UNDER_FILTERED"));
assert.ok(livebearerDraft.flags.includes("HEAVY_LIVEBEARER_LOAD"));

const tinyExtreme = mockAquariumStockingPressure(context({
  aquarium: { ...context().aquarium, volume: 10, volumeGallons: 10 },
  stocking: [{ itemId: "tiny", itemType: "FISH", name: "Messy tiny fish", quantity: 8, status: "IN_AQUARIUM", notes: null, species: { id: "tiny", category: "FISH", commonName: "Messy tiny fish", scientificName: null, maxSize: "0.8 in", bioloadClass: "EXTREME", maxHeight: null, notes: null, careNotes: null, husbandryFields: null } }]
}));
assert.ok(["LIGHT", "MODERATE", "HEAVY"].includes(tinyExtreme.level));

const hugeExtreme = mockAquariumStockingPressure(context({
  aquarium: { ...context().aquarium, volume: 40, volumeGallons: 40 },
  stocking: [{ itemId: "huge", itemType: "FISH", name: "Huge messy fish", quantity: 2, status: "IN_AQUARIUM", notes: null, species: { id: "huge", category: "FISH", commonName: "Huge messy fish", scientificName: null, maxSize: "14 in", bioloadClass: "EXTREME", maxHeight: null, notes: null, careNotes: null, husbandryFields: null } }]
}));
assert.ok(["HEAVY", "OVERSTOCKED"].includes(hugeExtreme.level));

const fingerprint = buildAquariumStockingPressureFingerprint(plantedShrimp);
assert.equal(fingerprint, buildAquariumStockingPressureFingerprint(structuredClone(plantedShrimp)));
assert.notEqual(fingerprint, buildAquariumStockingPressureFingerprint({ ...plantedShrimp, aquarium: { ...plantedShrimp.aquarium, volume: 12, volumeGallons: 12 } }));
assert.notEqual(fingerprint, buildAquariumStockingPressureFingerprint({ ...plantedShrimp, stocking: plantedShrimp.stocking.map((item) => item.itemId === "shrimp" ? { ...item, quantity: 31 } : item) }));
assert.notEqual(fingerprint, buildAquariumStockingPressureFingerprint({ ...plantedShrimp, filtration: [] }));

assert.deepEqual(derivePreliminaryStockingPressureFlags(context({ aquarium: { ...context().aquarium, volume: null, volumeGallons: null }, filtration: [] })), ["SPARSE_DATA"]);
assert.ok(shrimpDraft.cautions.some((caution) => caution.includes("not a substitute for water testing or observation")));
assert.doesNotMatch(JSON.stringify(shrimpDraft), /percent|percentage|score/i);
assert.ok(shrimpDraft.flags.length <= 4);
assert.equal(isStockingItemIncluded({ status: "DEAD" }, "DISPLAY"), false);
assert.equal(isStockingItemIncluded({ status: "IN_STORAGE" }, "DISPLAY"), false);
assert.equal(isStockingItemIncluded({ status: "ACTIVE", storageLocationId: "shelf" }, "DISPLAY"), false);
assert.equal(isStockingItemIncluded({ status: "IN_QUARANTINE", quarantineProjectId: "quarantine" }, "DISPLAY"), false);
assert.equal(isStockingItemIncluded({ status: "IN_QUARANTINE", quarantineProjectId: "quarantine" }, "QUARANTINE"), true);

console.log("Stocking Pressure fingerprint, flags, and mock-provider checks passed.");
