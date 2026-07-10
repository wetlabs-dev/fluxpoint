import assert from "node:assert/strict";
import { analyzeMetric } from "../src/domains/aquarium-intelligence/parameter-analysis";
import { buildHealthAssessment } from "../src/domains/aquarium-intelligence/health-assessment";
import { generateTimelineInsights } from "../src/domains/aquarium-intelligence/timeline-analysis";

const now = new Date("2026-07-10T12:00:00Z");

function context(overrides: Partial<any> = {}) {
  return {
    collectionId: "collection",
    windowStart: new Date("2026-04-11T12:00:00Z"),
    windowEnd: now,
    aquarium: {
      id: "tank",
      collectionId: "collection",
      name: "Test tank",
      updatedAt: now,
      profile: { targetAmmoniaMin: 0, targetAmmoniaMax: 0, targetNitriteMin: 0, targetNitriteMax: 0, targetNitrateMax: 40, targetPhMin: 6.5, targetPhMax: 7.6 },
      readings: [],
      events: [],
      careTasks: [],
      workflowRuns: [],
      healthConditions: [],
      medicationCourses: [],
      stockingPressureEstimates: [],
      waterChangeEvents: [],
      equipmentAttachments: [],
      items: [],
      additionalContents: [],
      ...overrides.aquarium
    }
  };
}

function reading(id: string, parameter: string, metricKey: string, value: number, daysAgo: number, source: "MANUAL" | "SENSOR" | "PROMETHEUS" | "IMPORTED" = "MANUAL") {
  return { id, parameter, metricKey, value, unit: parameter === "PH" ? "pH" : "ppm", source, measuredAt: new Date(now.getTime() - daysAgo * 86_400_000) };
}

const sparse = buildHealthAssessment(context());
assert.equal(sparse.healthState, "INSUFFICIENT_DATA");

const ammoniaContext = context({ aquarium: { readings: [reading("a1", "AMMONIA", "ammonia", 0.8, 20), reading("a2", "AMMONIA", "ammonia", 0.9, 10), reading("a3", "AMMONIA", "ammonia", 1.0, 1)] } });
const ammonia = analyzeMetric(ammoniaContext, "ammonia", ammoniaContext.aquarium.readings);
assert.equal(ammonia.concernState, "CRITICAL");

const nitrateRows = [reading("n1", "NITRATE", "nitrate", 10, 30), reading("n2", "NITRATE", "nitrate", 18, 20), reading("n3", "NITRATE", "nitrate", 28, 10), reading("n4", "NITRATE", "nitrate", 36, 1)];
const nitrate = analyzeMetric(context({ aquarium: { readings: nitrateRows } }), "nitrate", nitrateRows);
assert.equal(nitrate.trendState, "RISING");
assert.equal(nitrate.concernState, "WATCH");

const phRows = [reading("p1", "PH", "ph", 6.4, 7, "SENSOR"), reading("p2", "PH", "ph", 7.8, 6, "SENSOR"), reading("p3", "PH", "ph", 6.3, 5, "SENSOR"), reading("p4", "PH", "ph", 7.9, 4, "SENSOR"), reading("p5", "PH", "ph", 6.4, 3, "SENSOR")];
const ph = analyzeMetric(context({ aquarium: { readings: phRows } }), "ph", phRows);
assert.equal(ph.stabilityState, "UNSTABLE");

const timelineContext = context({ aquarium: { events: [
  { id: "light", aquariumId: "tank", eventType: "EQUIPMENT_CHANGE", title: "Lighting schedule increased", summary: null, notes: null, eventDate: new Date("2026-07-01T12:00:00Z"), updatedAt: new Date("2026-07-01T12:00:00Z"), relatedItemId: null, relatedSpeciesId: null, relatedConditionId: null },
  { id: "cond", aquariumId: "tank", eventType: "CONDITION_CREATED", title: "Algae outbreak", summary: null, notes: null, eventDate: new Date("2026-07-08T12:00:00Z"), updatedAt: new Date("2026-07-08T12:00:00Z"), relatedItemId: null, relatedSpeciesId: null, relatedConditionId: "condition" }
] } });
const insights = generateTimelineInsights(timelineContext);
assert.ok(insights[0]?.summary.includes("not proof of cause"));

console.log("Aquarium Intelligence deterministic checks passed.");
