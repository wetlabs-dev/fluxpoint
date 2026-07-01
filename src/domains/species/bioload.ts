export const speciesBioloadClasses = ["NEGLIGIBLE", "LOW", "MODERATE", "HIGH", "EXTREME"] as const;

export type SpeciesBioloadClass = typeof speciesBioloadClasses[number];

export const speciesBioloadClassLabels: Record<SpeciesBioloadClass, string> = {
  NEGLIGIBLE: "Negligible",
  LOW: "Low",
  MODERATE: "Moderate",
  HIGH: "High",
  EXTREME: "Extreme"
};

export const speciesBioloadPressureMultipliers: Record<SpeciesBioloadClass, number> = {
  NEGLIGIBLE: 0.12,
  LOW: 0.45,
  MODERATE: 1,
  HIGH: 1.8,
  EXTREME: 3.4
};

export function supportsSpeciesBioload(category: string | null | undefined) {
  return category !== "PLANT";
}

export function normalizeSpeciesBioloadClass(value: unknown, category?: string | null): SpeciesBioloadClass | null {
  if (!supportsSpeciesBioload(category)) return null;
  const normalized = String(value ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  return speciesBioloadClasses.includes(normalized as SpeciesBioloadClass) ? normalized as SpeciesBioloadClass : null;
}

export function labelSpeciesBioloadClass(value: string | null | undefined) {
  const normalized = normalizeSpeciesBioloadClass(value);
  return normalized ? speciesBioloadClassLabels[normalized] : null;
}
