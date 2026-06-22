export type Habitat = "Freshwater" | "Brackish" | "Marine";
export type AquariumSalinity = "FRESHWATER" | "BRACKISH" | "MARINE";

export const SALINITY_BANDS = {
  FRESHWATER: { min: 0, max: 0.5, label: "Freshwater" },
  BRACKISH: { min: 0.5, max: 30, label: "Brackish" },
  MARINE: { min: 30, max: Number.POSITIVE_INFINITY, label: "Marine" }
} as const;

export function salinityRangeForLegacy(salinity: AquariumSalinity) {
  const band = SALINITY_BANDS[salinity];
  return { min: band.min, max: Number.isFinite(band.max) ? band.max : 40 };
}

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

export function salinityRangesOverlap(
  aquariumMin: number | null | undefined,
  aquariumMax: number | null | undefined,
  speciesMin: number | null | undefined,
  speciesMax: number | null | undefined
) {
  if (aquariumMin == null && aquariumMax == null) return false;
  if (speciesMin == null && speciesMax == null) return false;
  const tankLow = Math.max(0, aquariumMin ?? aquariumMax ?? 0);
  const tankHigh = Math.max(tankLow, aquariumMax ?? tankLow);
  const speciesLow = Math.max(0, speciesMin ?? speciesMax ?? 0);
  const speciesHigh = Math.max(speciesLow, speciesMax ?? speciesLow);
  return tankLow <= speciesHigh && speciesLow <= tankHigh;
}

export function speciesMatchesAquariumTarget(
  aquariumMin: number | null | undefined,
  aquariumMax: number | null | undefined,
  speciesMin: number | null | undefined,
  speciesMax: number | null | undefined
) {
  return salinityRangesOverlap(aquariumMin, aquariumMax, speciesMin, speciesMax);
}

export function legacySalinityForRange(min: number | null | undefined, max: number | null | undefined): AquariumSalinity {
  const habitats = habitatsForSalinity(min, max);
  if (habitats.length === 1) return habitats[0].toUpperCase() as AquariumSalinity;
  const low = Math.max(0, min ?? 0);
  if (low >= 30) return "MARINE";
  if ((max ?? low) > 0.5) return "BRACKISH";
  return "FRESHWATER";
}

export function aquariumSalinityLabel(salinity: AquariumSalinity) {
  return SALINITY_BANDS[salinity].label;
}
