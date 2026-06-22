import assert from "node:assert/strict";
import { calculateParameterOverlap, mockAquariumParameterAdvisor, parseRangeText, type AdvisorStockedSpecies, type AquariumParameterAdvisorContext } from "../src/domains/aquariums/parameter-advisor";

const species: AdvisorStockedSpecies[] = [
  { itemId: "ember", name: "Ember Tetra", category: "FISH", quantity: 10, ranges: { temperature: { min: 74, max: 82, unit: "°F" }, ph: { min: 5.5, max: 7.5, unit: "" }, salinity: { min: 0, max: 0.5, unit: "ppt" } }, husbandrySummary: null },
  { itemId: "shrimp", name: "Amano Shrimp", category: "INVERT", quantity: 6, ranges: { temperature: { min: 68, max: 80, unit: "°F" }, ph: { min: 6.5, max: 8, unit: "" }, salinity: { min: 0, max: 0.5, unit: "ppt" } }, husbandrySummary: null }
];
assert.deepEqual(parseRangeText("120–180 ppm", "ppm"), { min: 120, max: 180, unit: "ppm" });

const temperature = calculateParameterOverlap(species, "temperature", { min: 74, max: 78, target: 76, unit: "°F" });
assert.equal(temperature.intersectionMin, 74);
assert.equal(temperature.intersectionMax, 80);
assert.equal(temperature.hasConflict, false);
assert.equal(temperature.currentTargetStatus, "ALIGNED");

const conflict = calculateParameterOverlap([{ ...species[0], ranges: { ph: { min: 5, max: 6, unit: "" } } }, { ...species[1], ranges: { ph: { min: 7, max: 8, unit: "" } } }], "ph", { min: 6.5, max: 7, unit: "" });
assert.equal(conflict.hasConflict, true);
assert.equal(conflict.currentTargetStatus, "CONFLICT");

const currentTargets = Object.fromEntries(["temperature", "ph", "gh", "kh", "salinity", "tds", "nitrate", "ammonia", "nitrite"].map((key) => [key, { min: key === "ammonia" ? 0.25 : 0, max: key === "ammonia" ? 0.5 : key === "nitrate" ? 60 : 10, target: null, unit: key === "ph" ? "" : "ppm" }])) as AquariumParameterAdvisorContext["currentTargets"];
const context: AquariumParameterAdvisorContext = { aquarium: { id: "tank", name: "Test tank" }, currentTargets, stocking: species, overlaps: Object.fromEntries(Object.keys(currentTargets).map((key) => [key, calculateParameterOverlap(species, key as keyof typeof currentTargets, currentTargets[key as keyof typeof currentTargets])])) as AquariumParameterAdvisorContext["overlaps"], activeConditions: [], activeMedications: [], recentLosses: [], latestReadings: [], recentTimeline: [] };
const draft = mockAquariumParameterAdvisor(context);
const ammonia = draft.recommendations.find((row) => row.parameter === "ammonia")!;
assert.equal(ammonia.status, "ADJUST");
assert.equal(ammonia.suggestedMin, 0);
assert.equal(ammonia.suggestedMax, 0);
assert.equal(draft.recommendations.find((row) => row.parameter === "nitrite")?.suggestedMax, 0);

console.log("Eddy Parameter Advisor overlap and safety checks passed.");
