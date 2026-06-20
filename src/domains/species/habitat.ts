export type Habitat = "Freshwater" | "Brackish" | "Marine";

export function habitatsForSalinity(min: number | null | undefined, max: number | null | undefined): Habitat[] {
  if (min == null && max == null) return [];
  const low = Math.max(0, min ?? 0);
  const high = Math.max(low, max ?? low);
  const habitats: Habitat[] = [];
  if (low <= 0.5) habitats.push("Freshwater");
  if (high > 0.5 && low < 30) habitats.push("Brackish");
  if (high >= 30) habitats.push("Marine");
  return habitats;
}
