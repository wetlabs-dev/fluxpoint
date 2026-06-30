import { parseLightChannels, valuesForPoint, type LightChannel } from "@/domains/lighting/capabilities";

export type LightLoadPoint = {
  timeOfDay: string;
  rampMinutes?: number | null;
  values: unknown;
  white: number;
  red: number;
  green: number;
  blue: number;
  warmWhite: number | null;
  intensity: number | null;
};

export type LightLoadProfile = { mode?: string; channels: unknown } | null;

export type LightOutputInput = number | {
  maxLumens?: number | null;
  wattage?: number | null;
  efficacyLumensPerWatt?: number | null;
  outputEstimateMethod?: "LUMENS" | "WATTAGE_ESTIMATED" | "UNKNOWN" | string | null;
} | null;

export type ResolvedLightOutput = {
  estimatedMaxLumens: number | null;
  outputMethod: "LUMENS" | "WATTAGE_ESTIMATED" | "UNKNOWN";
  confidence: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
  efficacyLumensPerWatt: number | null;
  description: string;
};

export type LightingSegment = {
  kind: "plateau" | "ramp";
  startMinute: number;
  endMinute: number;
  startIntensity: number;
  endIntensity: number;
  startValues: Record<string, number>;
  endValues: Record<string, number>;
};

export type LightingSample = {
  minute: number;
  intensity: number;
  values: Record<string, number>;
};

function normalizedChannelValue(value: number, channel: LightChannel) {
  if (!Number.isFinite(value)) return 0;
  const span = channel.max - channel.min;
  return span > 0 ? Math.min(1, Math.max(0, (value - channel.min) / span)) : 0;
}

export function deriveChannelIntensity(pointValues: Record<string, number>, profile: LightLoadProfile) {
  const channels = parseLightChannels(profile?.channels);
  if (!channels.length) return 0;
  if (profile?.mode === "ON_OFF") return Number(pointValues.power ?? 0) > 0 ? 1 : 0;
  const luminous = channels.filter((channel) => channel.key !== "power");
  if (!luminous.length) return 0;
  const values = luminous.map((channel) => normalizedChannelValue(Number(pointValues[channel.key] ?? 0), channel));
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function derivePointLumens(maxLumens: number, pointValues: Record<string, number>, profile: LightLoadProfile) {
  return maxLumens * deriveChannelIntensity(pointValues, profile);
}

function minuteOfDay(time: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour < 24 && minute >= 0 && minute < 60 ? hour * 60 + minute : null;
}

function clampRampMinutes(value: number | null | undefined) {
  const numeric = Number(value ?? 30);
  return Number.isFinite(numeric) ? Math.min(1440, Math.max(0, Math.round(numeric))) : 30;
}

function interpolateValues(startValues: Record<string, number>, endValues: Record<string, number>, progress: number) {
  const keys = new Set([...Object.keys(startValues), ...Object.keys(endValues)]);
  return Object.fromEntries(Array.from(keys).map((key) => {
    const start = Number(startValues[key] ?? 0);
    const end = Number(endValues[key] ?? 0);
    return [key, start + (end - start) * progress];
  }));
}

export function buildLightingSegments(points: LightLoadPoint[], profile: LightLoadProfile, rampMinutes?: number | null): LightingSegment[] {
  const ordered = points.flatMap((point) => {
    const minute = minuteOfDay(point.timeOfDay);
    const values = valuesForPoint(point);
    return minute === null ? [] : [{ point, minute, values, intensity: deriveChannelIntensity(values, profile) }];
  }).sort((a, b) => a.minute - b.minute);
  if (!ordered.length) return [];
  if (ordered.length === 1) return [{
    kind: "plateau",
    startMinute: 0,
    endMinute: 1440,
    startIntensity: ordered[0].intensity,
    endIntensity: ordered[0].intensity,
    startValues: ordered[0].values,
    endValues: ordered[0].values
  }];
  const segments: LightingSegment[] = [];
  const scheduleRamp = profile?.mode === "ON_OFF" ? 0 : clampRampMinutes(rampMinutes ?? ordered.find((entry) => Number(entry.point.rampMinutes ?? 0) > 0)?.point.rampMinutes ?? ordered[0]?.point.rampMinutes);
  for (let index = 0; index < ordered.length; index += 1) {
    const current = ordered[index];
    const next = ordered[(index + 1) % ordered.length];
    const nextMinute = next.minute + (index === ordered.length - 1 ? 1440 : 0);
    const interval = nextMinute - current.minute;
    const ramp = Math.min(interval, scheduleRamp);
    if (interval - ramp > 0) segments.push({
      kind: "plateau",
      startMinute: current.minute,
      endMinute: nextMinute - ramp,
      startIntensity: current.intensity,
      endIntensity: current.intensity,
      startValues: current.values,
      endValues: current.values
    });
    if (ramp > 0) segments.push({
      kind: "ramp",
      startMinute: nextMinute - ramp,
      endMinute: nextMinute,
      startIntensity: current.intensity,
      endIntensity: next.intensity,
      startValues: current.values,
      endValues: next.values
    });
    else if (interval > 0 && current.intensity !== next.intensity) segments.push({
      kind: "ramp",
      startMinute: nextMinute,
      endMinute: nextMinute,
      startIntensity: current.intensity,
      endIntensity: next.intensity,
      startValues: current.values,
      endValues: next.values
    });
  }
  return segments;
}

export function intensityAtMinute(segments: LightingSegment[], minute: number) {
  if (!segments.length) return 0;
  const firstMinute = segments[0].startMinute;
  let normalized = minute;
  while (normalized < firstMinute) normalized += 1440;
  while (normalized > firstMinute + 1440) normalized -= 1440;
  const immediate = segments.find((entry) => entry.startMinute === entry.endMinute && Math.abs(normalized - entry.startMinute) < 0.001);
  if (immediate) return immediate.endIntensity;
  const segment = segments.find((entry) => entry.endMinute > entry.startMinute && normalized >= entry.startMinute && normalized <= entry.endMinute) ?? segments.at(-1)!;
  if (segment.kind === "plateau" || segment.endMinute === segment.startMinute) return segment.endIntensity;
  const progress = (normalized - segment.startMinute) / (segment.endMinute - segment.startMinute);
  return segment.startIntensity + (segment.endIntensity - segment.startIntensity) * Math.min(1, Math.max(0, progress));
}

export function sampleAtMinute(segments: LightingSegment[], minute: number): LightingSample {
  if (!segments.length) return { minute, intensity: 0, values: {} };
  const firstMinute = segments[0].startMinute;
  let normalized = minute;
  while (normalized < firstMinute) normalized += 1440;
  while (normalized > firstMinute + 1440) normalized -= 1440;
  const immediate = segments.find((entry) => entry.startMinute === entry.endMinute && Math.abs(normalized - entry.startMinute) < 0.001);
  const segment = immediate ?? segments.find((entry) => entry.endMinute > entry.startMinute && normalized >= entry.startMinute && normalized <= entry.endMinute) ?? segments.at(-1)!;
  if (segment.kind === "plateau" || segment.endMinute === segment.startMinute) return { minute, intensity: segment.endIntensity, values: segment.endValues };
  const progress = Math.min(1, Math.max(0, (normalized - segment.startMinute) / (segment.endMinute - segment.startMinute)));
  return {
    minute,
    intensity: segment.startIntensity + (segment.endIntensity - segment.startIntensity) * progress,
    values: interpolateValues(segment.startValues, segment.endValues, progress)
  };
}

export function sampleLightingSchedule(points: LightLoadPoint[], profile: LightLoadProfile, rampMinutes?: number | null, intervalMinutes = 5) {
  const segments = buildLightingSegments(points, profile, rampMinutes);
  if (!segments.length) return [];
  const step = Math.max(1, Math.min(60, Math.round(intervalMinutes)));
  const sampleMinutes = new Set([0, 1440]);
  for (let minute = 0; minute <= 1440; minute += step) sampleMinutes.add(minute);
  for (const segment of segments) {
    for (const minute of [segment.startMinute, segment.endMinute]) {
      const normalized = ((minute % 1440) + 1440) % 1440;
      sampleMinutes.add(normalized);
      sampleMinutes.add(Math.max(0, normalized - 0.01));
      sampleMinutes.add(Math.min(1440, normalized + 0.01));
    }
  }
  return Array.from(sampleMinutes).sort((a, b) => a - b).map((minute) => sampleAtMinute(segments, minute));
}

export function resolveLightOutput(output: LightOutputInput, profile: LightLoadProfile = null): ResolvedLightOutput {
  const values = typeof output === "number" ? { maxLumens: output } : output ?? {};
  const maxLumens = Number(values.maxLumens ?? 0);
  if (Number.isFinite(maxLumens) && maxLumens > 0) {
    return { estimatedMaxLumens: maxLumens, outputMethod: "LUMENS", confidence: "HIGH", efficacyLumensPerWatt: null, description: `${Math.round(maxLumens).toLocaleString()} lm rated output` };
  }
  const wattage = Number(values.wattage ?? 0);
  if (!Number.isFinite(wattage) || wattage <= 0) {
    return { estimatedMaxLumens: null, outputMethod: "UNKNOWN", confidence: "UNKNOWN", efficacyLumensPerWatt: null, description: "No lumen or wattage output recorded" };
  }
  const suppliedEfficacy = Number(values.efficacyLumensPerWatt ?? 0);
  const hasSuppliedEfficacy = Number.isFinite(suppliedEfficacy) && suppliedEfficacy > 0;
  const efficacy = hasSuppliedEfficacy ? suppliedEfficacy : !profile || profile.mode === "ON_OFF" ? 50 : 70;
  const estimatedMaxLumens = wattage * efficacy;
  return {
    estimatedMaxLumens,
    outputMethod: "WATTAGE_ESTIMATED",
    confidence: hasSuppliedEfficacy ? "MEDIUM" : "LOW",
    efficacyLumensPerWatt: efficacy,
    description: `${wattage.toLocaleString()} W estimated at ${efficacy.toLocaleString()} lm/W`
  };
}

export function calculateScheduleLightLoad(points: LightLoadPoint[], profile: LightLoadProfile, output?: LightOutputInput, rampMinutes?: number | null) {
  const segments = buildLightingSegments(points, profile, rampMinutes);
  const resolvedOutput = resolveLightOutput(output ?? null, profile);
  if (!segments.length) return { equivalentFullOutputHours: null, estimatedLumenHours: null, displayValue: "Schedule points are incomplete", missingInputs: ["schedulePoints"], ...resolvedOutput };
  const equivalentFullOutputHours = segments.reduce((total, segment) => {
    const hours = (segment.endMinute - segment.startMinute) / 60;
    return total + hours * (segment.startIntensity + segment.endIntensity) / 2;
  }, 0);
  if (!resolvedOutput.estimatedMaxLumens) return { equivalentFullOutputHours, estimatedLumenHours: null, displayValue: "Add max lumens or wattage to estimate light load", missingInputs: ["maxLumens", "wattage"], ...resolvedOutput };
  const estimatedLumenHours = equivalentFullOutputHours * resolvedOutput.estimatedMaxLumens;
  return { equivalentFullOutputHours, estimatedLumenHours, displayValue: formatLightLoad(estimatedLumenHours), missingInputs: [] as string[], ...resolvedOutput };
}

export function formatLightLoad(value: number) {
  return `${Math.round(value).toLocaleString()} lumen-hours`;
}

export function formatCompactLightLoad(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 1 : 2)}k lh` : `${Math.round(value)} lh`;
}

export function percentLightLoadChange(previous: number | null, next: number | null) {
  if (previous === null || next === null || previous === 0) return null;
  return (next - previous) / previous * 100;
}
