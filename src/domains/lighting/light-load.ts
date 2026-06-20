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

export type LightingSegment = {
  kind: "plateau" | "ramp";
  startMinute: number;
  endMinute: number;
  startIntensity: number;
  endIntensity: number;
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

export function buildLightingSegments(points: LightLoadPoint[], profile: LightLoadProfile): LightingSegment[] {
  const ordered = points.flatMap((point) => {
    const minute = minuteOfDay(point.timeOfDay);
    return minute === null ? [] : [{ point, minute, intensity: deriveChannelIntensity(valuesForPoint(point), profile) }];
  }).sort((a, b) => a.minute - b.minute);
  if (!ordered.length) return [];
  if (ordered.length === 1) return [{ kind: "plateau", startMinute: 0, endMinute: 1440, startIntensity: ordered[0].intensity, endIntensity: ordered[0].intensity }];
  const segments: LightingSegment[] = [];
  for (let index = 0; index < ordered.length; index += 1) {
    const current = ordered[index];
    const next = ordered[(index + 1) % ordered.length];
    const nextMinute = next.minute + (index === ordered.length - 1 ? 1440 : 0);
    const interval = nextMinute - current.minute;
    // Existing Fluxpoint schedules define rampMinutes on the destination point: the ramp ends when that point time is reached.
    const requestedRamp = profile?.mode === "ON_OFF" ? 0 : Math.max(0, Math.round(next.point.rampMinutes ?? 0));
    const ramp = Math.min(interval, requestedRamp);
    if (interval - ramp > 0) segments.push({ kind: "plateau", startMinute: current.minute, endMinute: nextMinute - ramp, startIntensity: current.intensity, endIntensity: current.intensity });
    if (ramp > 0) segments.push({ kind: "ramp", startMinute: nextMinute - ramp, endMinute: nextMinute, startIntensity: current.intensity, endIntensity: next.intensity });
    else if (interval > 0 && current.intensity !== next.intensity) segments.push({ kind: "ramp", startMinute: nextMinute, endMinute: nextMinute, startIntensity: current.intensity, endIntensity: next.intensity });
  }
  return segments;
}

export function calculateScheduleLightLoad(points: LightLoadPoint[], profile: LightLoadProfile, maxLumens?: number | null) {
  const segments = buildLightingSegments(points, profile);
  if (!segments.length) return { equivalentFullOutputHours: null, estimatedLumenHours: null, displayValue: "Schedule points are incomplete", missingInputs: ["schedulePoints"] };
  const equivalentFullOutputHours = segments.reduce((total, segment) => {
    const hours = (segment.endMinute - segment.startMinute) / 60;
    return total + hours * (segment.startIntensity + segment.endIntensity) / 2;
  }, 0);
  if (!maxLumens || maxLumens <= 0) return { equivalentFullOutputHours, estimatedLumenHours: null, displayValue: "Add max lumens to estimate light load", missingInputs: ["maxLumens"] };
  const estimatedLumenHours = equivalentFullOutputHours * maxLumens;
  return { equivalentFullOutputHours, estimatedLumenHours, displayValue: formatLightLoad(estimatedLumenHours), missingInputs: [] as string[] };
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
