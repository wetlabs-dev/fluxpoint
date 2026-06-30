import { buildLightingSegments, calculateScheduleLightLoad, deriveChannelIntensity, sampleLightingSchedule } from "../src/domains/lighting/light-load";

const profiles = {
  onOff: { mode: "ON_OFF", channels: [{ key: "power", label: "Power", color: "#fff", min: 0, max: 1, step: 1 }] },
  dimmer: { mode: "DIMMABLE", channels: [{ key: "intensity", label: "Intensity", color: "#fff", min: 0, max: 100, step: 1 }] },
  rgbw: { mode: "RGBW", channels: ["red", "green", "blue", "white"].map((key) => ({ key, label: key, color: "#fff", min: 0, max: 100, step: 1 })) }
};

function point(timeOfDay: string, values: Record<string, number>, rampMinutes = 0) {
  return { timeOfDay, values, rampMinutes, white: values.white ?? 0, red: values.red ?? 0, green: values.green ?? 0, blue: values.blue ?? 0, warmWhite: null, intensity: values.intensity ?? null };
}

function close(actual: number | null, expected: number, label: string) {
  if (actual === null || Math.abs(actual - expected) > 0.001) throw new Error(`${label}: expected ${expected}, received ${actual}`);
}

close(calculateScheduleLightLoad([point("00:00", { power: 0 }), point("12:00", { power: 1 })], profiles.onOff, 1000).estimatedLumenHours, 12000, "on/off 12 hours");
close(calculateScheduleLightLoad([point("00:00", { intensity: 0 }), point("08:00", { intensity: 50 }), point("16:00", { intensity: 0 })], profiles.dimmer, 2000).estimatedLumenHours, 8000, "dimmer 50 percent");
const ramp = buildLightingSegments([point("00:00", { intensity: 100 }), point("23:00", { intensity: 0 })], profiles.dimmer, 60).find((segment) => segment.kind === "ramp" && segment.endMinute - segment.startMinute === 60);
close(ramp ? (ramp.startIntensity + ramp.endIntensity) / 2 * 1000 : null, 500, "one-hour ramp area");
close(deriveChannelIntensity({ red: 50, green: 50, blue: 50, white: 100 }, profiles.rgbw), 0.625, "RGBW average");
close(calculateScheduleLightLoad([point("02:00", { intensity: 0 }), point("22:00", { intensity: 100 })], profiles.dimmer, 1000).estimatedLumenHours, 4000, "overnight segment");
const missing = calculateScheduleLightLoad([point("00:00", { intensity: 50 })], profiles.dimmer, null);
if (missing.estimatedLumenHours !== null || !missing.missingInputs.includes("maxLumens") || !missing.missingInputs.includes("wattage")) throw new Error("missing output state failed");
const combined = [1000, 1500].reduce((sum, lumens) => sum + (calculateScheduleLightLoad([point("00:00", { intensity: 50 })], profiles.dimmer, lumens).estimatedLumenHours ?? 0), 0);
close(combined, 30000, "multiple-light total");
const wrapSegments = buildLightingSegments([point("13:00", { intensity: 100 }), point("21:00", { intensity: 0 })], profiles.dimmer, 30);
close(wrapSegments.reduce((sum, segment) => sum + segment.endMinute - segment.startMinute, 0), 1440, "continuous 24-hour wrap");
if (!wrapSegments.some((segment) => segment.endMinute > 1440)) throw new Error("final-to-first segment did not wrap into the next day");
const offSamples = sampleLightingSchedule([point("08:00", { red: 0, green: 0, blue: 0, white: 0 }), point("20:00", { red: 0, green: 0, blue: 0, white: 0 })], profiles.rgbw, 30);
if (!offSamples.length || offSamples.some((sample) => sample.intensity !== 0 || Object.values(sample.values).some((value) => value !== 0))) throw new Error("all-zero RGBW schedule did not stay off");
const sampledRamp = sampleLightingSchedule([point("08:00", { intensity: 0 }), point("09:00", { intensity: 100 })], profiles.dimmer, 30).find((sample) => sample.minute === 525);
close(sampledRamp?.intensity ?? null, 0.5, "schedule-level ramp sampling");
const wattage = calculateScheduleLightLoad([point("00:00", { intensity: 50 })], profiles.dimmer, { wattage: 20 });
close(wattage.estimatedLumenHours, 16800, "wattage fallback");
if (wattage.outputMethod !== "WATTAGE_ESTIMATED" || wattage.confidence !== "LOW") throw new Error("wattage fallback confidence failed");
const suppliedEfficacy = calculateScheduleLightLoad([point("00:00", { intensity: 50 })], profiles.dimmer, { wattage: 20, efficacyLumensPerWatt: 90 });
close(suppliedEfficacy.estimatedLumenHours, 21600, "supplied efficacy");
if (suppliedEfficacy.confidence !== "MEDIUM") throw new Error("supplied efficacy confidence failed");
console.log("Estimated Daily Light Load checks passed.");
