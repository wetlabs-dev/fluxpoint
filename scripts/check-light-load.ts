import { buildLightingSegments, calculateScheduleLightLoad, deriveChannelIntensity } from "../src/domains/lighting/light-load";

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
const ramp = buildLightingSegments([point("00:00", { intensity: 100 }), point("23:00", { intensity: 0 }, 60)], profiles.dimmer).find((segment) => segment.kind === "ramp" && segment.endMinute - segment.startMinute === 60);
close(ramp ? (ramp.startIntensity + ramp.endIntensity) / 2 * 1000 : null, 500, "one-hour ramp area");
close(deriveChannelIntensity({ red: 50, green: 50, blue: 50, white: 100 }, profiles.rgbw), 0.625, "RGBW average");
close(calculateScheduleLightLoad([point("02:00", { intensity: 0 }), point("22:00", { intensity: 100 })], profiles.dimmer, 1000).estimatedLumenHours, 4000, "overnight segment");
const missing = calculateScheduleLightLoad([point("00:00", { intensity: 50 })], profiles.dimmer, null);
if (missing.estimatedLumenHours !== null || !missing.missingInputs.includes("maxLumens")) throw new Error("missing max lumens state failed");
const combined = [1000, 1500].reduce((sum, lumens) => sum + (calculateScheduleLightLoad([point("00:00", { intensity: 50 })], profiles.dimmer, lumens).estimatedLumenHours ?? 0), 0);
close(combined, 30000, "multiple-light total");
console.log("Estimated Daily Light Load checks passed.");
