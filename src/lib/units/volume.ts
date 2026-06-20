export type VolumeUnit = "GALLON" | "LITER";

const LITERS_PER_GALLON = 3.785411784;

export function convertVolume(value: number, from: VolumeUnit, to: VolumeUnit) {
  if (from === to) return value;
  return from === "GALLON" ? value * LITERS_PER_GALLON : value / LITERS_PER_GALLON;
}

export function volumePair(value: number, unit: VolumeUnit) {
  return {
    gallons: unit === "GALLON" ? value : convertVolume(value, "LITER", "GALLON"),
    liters: unit === "LITER" ? value : convertVolume(value, "GALLON", "LITER")
  };
}

export function formatVolume(value: number | null | undefined, unit: VolumeUnit = "GALLON") {
  if (value == null) return "Volume not recorded";
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${unit === "GALLON" ? "gal" : "L"}`;
}
