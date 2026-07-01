export type HusbandrySpeciesType = "FRESHWATER_FISH" | "MARINE_FISH" | "PLANT" | "INVERTEBRATE" | "CORAL" | "OTHER";

export type HusbandryField = {
  key: string;
  label: string;
  help?: string;
  multiline?: boolean;
};

export type HusbandrySection = {
  key: string;
  title: string;
  fields: HusbandryField[];
};

export type HusbandryValues = Record<string, string | null>;

const f = (key: string, label?: string, help?: string): HusbandryField => ({
  key,
  label: label ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase()),
  help,
  multiline: /notes|issues|foods|care|risk|needs|methods|deficiencies|sensitivity|compatibility|quarantine|spawning|fragging|pest/i.test(key)
});

const commonFishDiet = [f("dietType"), f("stapleFoods"), f("treatFoods"), f("feedingFrequency")];
const commonFishBehavior = [f("schoolingBehavior"), f("aggression"), f("territoryNeeds"), f("compatibilityNotes")];
const commonFishHealth = [f("commonIssues"), f("medicationSensitivity"), f("quarantineNotes")];
const plantCompatibilityField = f(
  "plantCompatibility",
  "Plant compatibility",
  "Notes on whether this species is suitable for planted tanks, likely to uproot plants, graze soft leaves, or require robust planting."
);

export const husbandrySectionsBySpeciesType: Record<HusbandrySpeciesType, HusbandrySection[]> = {
  FRESHWATER_FISH: [
    { key: "summary", title: "Summary", fields: [f("temperament"), f("minimumTankSize")] },
    { key: "environment", title: "Environment", fields: [plantCompatibilityField, f("aquascapeNeeds")] },
    { key: "diet", title: "Diet", fields: commonFishDiet },
    { key: "behavior", title: "Behavior", fields: commonFishBehavior },
    { key: "breeding", title: "Breeding", fields: [f("breedingType"), f("spawningNotes"), f("fryCare")] },
    { key: "health", title: "Health", fields: commonFishHealth }
  ],
  MARINE_FISH: [
    { key: "summary", title: "Summary", fields: [f("temperament"), f("minimumTankSize")] },
    { key: "environment", title: "Environment", fields: [f("alkalinityRange"), f("nitrateTolerance"), plantCompatibilityField, f("aquascapeNeeds")] },
    { key: "diet", title: "Diet", fields: commonFishDiet },
    { key: "behavior", title: "Behavior", fields: commonFishBehavior },
    { key: "reef", title: "Reef Compatibility", fields: [f("reefSafe"), f("coralRisk"), f("invertRisk")] },
    { key: "health", title: "Health", fields: commonFishHealth }
  ],
  PLANT: [
    { key: "summary", title: "Summary", fields: [f("placement")] },
    { key: "light", title: "Light/CO2", fields: [f("photoperiod")] },
    { key: "environment", title: "Environment", fields: [f("hardnessRange"), f("waterOrHabitatNotes")] },
    { key: "nutrition", title: "Nutrition", fields: [f("fertilizerNeeds"), f("rootFeeder"), f("waterColumnFeeder")] },
    { key: "propagation", title: "Propagation", fields: [f("propagationMethods"), f("trimmingNotes")] },
    { key: "problems", title: "Problems", fields: [f("commonDeficiencies"), f("algaeSensitivity"), f("meltingNotes")] }
  ],
  INVERTEBRATE: [
    { key: "summary", title: "Summary", fields: [f("temperament")] },
    { key: "environment", title: "Environment", fields: [plantCompatibilityField, f("copperSensitivity"), f("waterOrHabitatNotes")] },
    { key: "diet", title: "Diet", fields: [f("dietType"), f("feedingNotes")] },
    { key: "behavior", title: "Behavior", fields: [f("compatibilityNotes")] },
    { key: "breeding", title: "Breeding", fields: [f("breedingNotes"), f("larvalNeeds")] },
    { key: "molting", title: "Molting/Health", fields: [f("moltingNotes"), f("commonIssues")] }
  ],
  CORAL: [
    { key: "summary", title: "Summary", fields: [f("growthForm"), f("aggression"), f("placement")] },
    { key: "light", title: "Light/Flow", fields: [f("parRange", "PAR range")] },
    { key: "water", title: "Water", fields: [f("alkalinityRange"), f("calciumRange"), f("magnesiumRange"), f("nitrateRange"), f("phosphateRange")] },
    { key: "feeding", title: "Feeding", fields: [f("feedingNeeds"), f("targetFeedingNotes")] },
    { key: "propagation", title: "Propagation", fields: [f("fraggingNotes")] },
    { key: "health", title: "Health", fields: [f("commonIssues"), f("pestNotes")] }
  ],
  OTHER: [
    { key: "summary", title: "Summary", fields: [f("environmentSummary"), f("minimumTankSize")] },
    { key: "environment", title: "Environment", fields: [f("waterOrHabitatNotes")] },
    { key: "nutrition", title: "Diet/Nutrition", fields: [f("dietType"), f("feedingNotes")] },
    { key: "behavior", title: "Behavior", fields: [f("temperament"), f("compatibilityNotes")] },
    { key: "reproduction", title: "Reproduction", fields: [f("breedingNotes")] },
    { key: "health", title: "Health", fields: [f("commonIssues"), f("quarantineNotes")] },
    { key: "notes", title: "Notes", fields: [f("generalNotes")] }
  ]
};

export const husbandryFieldRegistry = Object.fromEntries(
  Object.entries(husbandrySectionsBySpeciesType).map(([type, sections]) => [
    type,
    sections.flatMap((section) => section.fields)
  ])
) as Record<HusbandrySpeciesType, HusbandryField[]>;

export function getHusbandryFieldsForSpeciesType(type: HusbandrySpeciesType) {
  return husbandryFieldRegistry[type] ?? husbandryFieldRegistry.OTHER;
}

export function getHusbandrySectionsForSpeciesType(type: HusbandrySpeciesType) {
  return husbandrySectionsBySpeciesType[type] ?? husbandrySectionsBySpeciesType.OTHER;
}

export function normalizeHusbandryFields(type: HusbandrySpeciesType, input: unknown): HusbandryValues {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
  return Object.fromEntries(getHusbandryFieldsForSpeciesType(type).map((field) => {
    const value = source[field.key];
    const normalized = typeof value === "string" ? value.trim() : value === null || value === undefined ? "" : String(value).trim();
    return [field.key, normalized || null];
  }));
}

export function parseHusbandryFormData(type: HusbandrySpeciesType, formData: FormData) {
  return normalizeHusbandryFields(type, Object.fromEntries(getHusbandryFieldsForSpeciesType(type).map((field) => [field.key, formData.get(field.key)])));
}

export function hasHusbandryData(type: HusbandrySpeciesType, fields: unknown) {
  return Object.values(normalizeHusbandryFields(type, fields)).some(Boolean);
}

export function mergeHusbandryValues(type: HusbandrySpeciesType, base: unknown, override: unknown): HusbandryValues {
  const baseValues = normalizeHusbandryFields(type, base);
  const overrideValues = normalizeHusbandryFields(type, override);
  return Object.fromEntries(Object.keys(baseValues).map((key) => [key, overrideValues[key] || baseValues[key] || null]));
}

export function husbandryDifferences(type: HusbandrySpeciesType, base: unknown, override: unknown) {
  const baseValues = normalizeHusbandryFields(type, base);
  const overrideValues = normalizeHusbandryFields(type, override);
  return new Set(Object.keys(baseValues).filter((key) => Boolean(overrideValues[key]) && overrideValues[key] !== baseValues[key]));
}

export function buildHusbandryBadges(type: HusbandrySpeciesType, fields: unknown) {
  const extraValues = fields && typeof fields === "object" && !Array.isArray(fields) ? fields as Record<string, unknown> : {};
  const values = { ...normalizeHusbandryFields(type, fields), ...Object.fromEntries(Object.entries(extraValues).flatMap(([key, value]) => {
    const normalized = typeof value === "string" ? value.trim() : value === null || value === undefined ? "" : String(value).trim();
    return normalized ? [[key, normalized]] : [];
  })) };
  const keys = type === "PLANT"
    ? ["careDifficulty", "placement", "fertilizerNeeds", "photoperiod"]
    : type === "CORAL"
      ? ["careDifficulty", "parRange", "aggression", "feedingNeeds"]
      : ["careDifficulty", "temperament", "dietType", "minimumTankSize"];
  return keys.flatMap((key) => values[key] ? [{ key, label: values[key]!, tone: inferHusbandryTone(key, values[key]) }] : []).slice(0, 4);
}

export function inferHusbandryTone(fieldKey: string, value: string | null | undefined) {
  const text = (value ?? "").toLowerCase();
  if (/difficult|high|expert|aggressive|sensitive|copper|strong|very/i.test(`${fieldKey} ${text}`)) return "warning";
  if (/easy|low|peaceful|hardy|safe/i.test(text)) return "good";
  if (/moderate|medium|verify|caution/i.test(text)) return "notice";
  return "neutral";
}

export function inferSpeciesHusbandryType(input: { category: string; notes?: string | null; commonName?: string | null }): HusbandrySpeciesType {
  const text = `${input.category} ${input.commonName ?? ""} ${input.notes ?? ""}`.toLowerCase();
  if (input.category === "PLANT") return "PLANT";
  if (input.category === "INVERT") return "INVERTEBRATE";
  if (input.category === "CORAL") return "CORAL";
  if (input.category === "FISH") return /marine|saltwater|reef|clown|tang|goby|wrasse/.test(text) ? "MARINE_FISH" : "FRESHWATER_FISH";
  return "OTHER";
}
