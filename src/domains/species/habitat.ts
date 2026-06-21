export type Habitat = "Freshwater" | "Brackish" | "Marine";
export type AquariumSalinity = "FRESHWATER" | "BRACKISH" | "MARINE";

export const SALINITY_BANDS = {
  FRESHWATER: { min: 0, max: 0.5, label: "Freshwater" },
  BRACKISH: { min: 0.5, max: 30, label: "Brackish" },
  MARINE: { min: 30, max: Number.POSITIVE_INFINITY, label: "Marine" }
} as const;

export function habitatsForSalinity(min: number | null | undefined, max: number | null | undefined): Habitat[] {
  if (min == null && max == null) return [];
  const low = Math.max(0, min ?? 0);
  const high = Math.max(low, max ?? low);
  const habitats: Habitat[] = [];
  if (low <= 0.5) habitats.push("Freshwater");
  if (high >= 0.5 && low <= 30) habitats.push("Brackish");
  if (high >= 30) habitats.push("Marine");
  return habitats;
}

export function speciesMatchesAquariumSalinity(
  salinity: AquariumSalinity,
  min: number | null | undefined,
  max: number | null | undefined
) {
  if (min == null && max == null) return false;
  return habitatsForSalinity(min, max).includes(SALINITY_BANDS[salinity].label);
}

export function aquariumSalinityLabel(salinity: AquariumSalinity) {
  return SALINITY_BANDS[salinity].label;
}
