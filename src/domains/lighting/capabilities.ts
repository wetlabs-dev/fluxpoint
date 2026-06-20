import { prisma } from "@/lib/db/prisma";

export type LightChannel = {
  key: string;
  label: string;
  color: string;
  min: number;
  max: number;
  step: number;
};

export type LightCapability = {
  id: string;
  name: string;
  mode: string;
  pointCount: number;
  channels: unknown;
};

export const defaultLightCapabilities = [
  {
    name: "On/off timer",
    description: "Simple outlet or fixture controlled by time only.",
    mode: "ON_OFF",
    pointCount: 2,
    channels: [{ key: "power", label: "Power", color: "#f3d37b", min: 0, max: 1, step: 1 }]
  },
  {
    name: "Single-channel dimmer",
    description: "Dimmable white or intensity-only aquarium light.",
    mode: "DIMMABLE",
    pointCount: 4,
    channels: [{ key: "intensity", label: "Intensity", color: "#f7d889", min: 0, max: 100, step: 5 }]
  },
  {
    name: "RGB fixture",
    description: "Red, green, and blue channels for color-tunable fixtures.",
    mode: "RGB",
    pointCount: 5,
    channels: [
      { key: "red", label: "Red", color: "#f87171", min: 0, max: 100, step: 5 },
      { key: "green", label: "Green", color: "#34d399", min: 0, max: 100, step: 5 },
      { key: "blue", label: "Blue", color: "#60a5fa", min: 0, max: 100, step: 5 }
    ]
  },
  {
    name: "RGBW fixture",
    description: "RGB channels plus a dedicated white channel.",
    mode: "RGBW",
    pointCount: 5,
    channels: [
      { key: "white", label: "White", color: "#f8fafc", min: 0, max: 100, step: 5 },
      { key: "red", label: "Red", color: "#f87171", min: 0, max: 100, step: 5 },
      { key: "green", label: "Green", color: "#34d399", min: 0, max: 100, step: 5 },
      { key: "blue", label: "Blue", color: "#60a5fa", min: 0, max: 100, step: 5 }
    ]
  }
] as const;

export function parseLightChannels(value: unknown): LightChannel[] {
  if (!Array.isArray(value)) return defaultLightCapabilities[1].channels.slice();
  return value.flatMap((channel) => {
    if (!channel || typeof channel !== "object") return [];
    const record = channel as Record<string, unknown>;
    const key = typeof record.key === "string" ? record.key : null;
    const label = typeof record.label === "string" ? record.label : key;
    if (!key || !label) return [];
    return [{
      key,
      label,
      color: typeof record.color === "string" ? record.color : "#7dd3fc",
      min: typeof record.min === "number" ? record.min : 0,
      max: typeof record.max === "number" ? record.max : 100,
      step: typeof record.step === "number" ? record.step : 5
    }];
  });
}

export async function ensureLightCapabilityProfiles(collectionId: string) {
  for (const profile of defaultLightCapabilities) {
    await prisma.lightCapabilityProfile.upsert({
      where: { collectionId_name: { collectionId, name: profile.name } },
      create: {
        collectionId,
        name: profile.name,
        description: profile.description,
        mode: profile.mode,
        pointCount: profile.pointCount,
        channels: profile.channels
      },
      update: {
        description: profile.description,
        mode: profile.mode,
        pointCount: profile.pointCount,
        channels: profile.channels
      }
    });
  }
  return prisma.lightCapabilityProfile.findMany({ where: { collectionId }, orderBy: { name: "asc" } });
}

export function pointValuesFromForm(formData: FormData, index: number, channels: LightChannel[]) {
  return Object.fromEntries(channels.map((channel) => {
    const raw = String(formData.get(`point-${index}-${channel.key}`) ?? "");
    const numeric = Number(raw || 0);
    const value = Number.isFinite(numeric) ? Math.min(Math.max(numeric, channel.min), channel.max) : channel.min;
    return [channel.key, value];
  }));
}

export function legacyPointValues(values: Record<string, number>) {
  return {
    white: Math.round(values.white ?? values.intensity ?? values.power ?? 0),
    red: Math.round(values.red ?? 0),
    green: Math.round(values.green ?? 0),
    blue: Math.round(values.blue ?? 0),
    warmWhite: values.warmWhite === undefined ? null : Math.round(values.warmWhite),
    intensity: Math.round(values.intensity ?? values.white ?? values.power ?? 0)
  };
}

export function valuesForPoint(point: { values: unknown; white: number; red: number; green: number; blue: number; warmWhite: number | null; intensity: number | null }) {
  if (point.values && typeof point.values === "object" && !Array.isArray(point.values)) {
    return point.values as Record<string, number>;
  }
  return {
    white: point.white,
    red: point.red,
    green: point.green,
    blue: point.blue,
    ...(point.warmWhite === null ? {} : { warmWhite: point.warmWhite }),
    ...(point.intensity === null ? {} : { intensity: point.intensity })
  };
}
