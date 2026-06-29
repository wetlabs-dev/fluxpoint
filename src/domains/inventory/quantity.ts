import type { ItemType, SpeciesCategory } from "@prisma/client";

export type InventoryItemType = ItemType | string | null | undefined;

const decimalUnits = new Set([
  "ml", "milliliter", "milliliters",
  "l", "liter", "liters",
  "g", "gram", "grams",
  "kg", "kilogram", "kilograms",
  "oz", "ounce", "ounces",
  "lb", "lbs", "pound", "pounds",
  "gal", "gallon", "gallons"
]);

export const biologicalItemTypes = ["FISH", "INVERT", "PLANT"] as const;
export type BiologicalItemType = typeof biologicalItemTypes[number];

export function isBiologicalItemType(itemType: InventoryItemType): itemType is BiologicalItemType {
  return itemType === "FISH" || itemType === "INVERT" || itemType === "PLANT";
}

export function isIntegerQuantityType(_itemType: InventoryItemType) {
  return true;
}

export function unitAllowsDecimalQuantity(unit?: string | null) {
  return Boolean(unit && decimalUnits.has(unit.trim().toLowerCase()));
}

export function getQuantityStep(itemType: InventoryItemType, unit?: string | null) {
  return unitAllowsDecimalQuantity(unit) ? "0.01" : "1";
}

export function getQuantityMin(_itemType: InventoryItemType, { allowZero = false } = {}) {
  return allowZero ? "0" : "1";
}

export function normalizeQuantityInput(value: unknown, itemType: InventoryItemType, unit?: string | null, fallback = 1) {
  const numeric = typeof value === "number" ? value : Number(String(value ?? "").trim());
  const base = Number.isFinite(numeric) ? numeric : fallback;
  if (unitAllowsDecimalQuantity(unit)) return base;
  if (isIntegerQuantityType(itemType)) return Math.max(0, Math.round(base));
  return base;
}

export function speciesCategoriesForInventoryItemType(itemType: InventoryItemType): SpeciesCategory[] {
  if (itemType === "FISH") return ["FISH"];
  if (itemType === "INVERT") return ["INVERT"];
  if (itemType === "PLANT") return ["PLANT"];
  return [];
}

export function speciesCategoriesForTankInhabitantType(itemType: InventoryItemType): SpeciesCategory[] {
  if (itemType === "OTHER" || itemType === "BOTANICAL") return ["CORAL", "OTHER"];
  return speciesCategoriesForInventoryItemType(itemType);
}

export function speciesMatchesItemType(itemType: InventoryItemType, category?: SpeciesCategory | string | null, options: { tankInhabitant?: boolean } = {}) {
  if (!category) return false;
  const allowed = options.tankInhabitant ? speciesCategoriesForTankInhabitantType(itemType) : speciesCategoriesForInventoryItemType(itemType);
  return allowed.includes(category as SpeciesCategory);
}

export function speciesPickerLabel(itemType: InventoryItemType) {
  if (itemType === "FISH") return "Select fish species";
  if (itemType === "INVERT") return "Select invertebrate species";
  if (itemType === "PLANT") return "Select plant species";
  if (itemType === "OTHER" || itemType === "BOTANICAL") return "Select coral or other species";
  return "Select species";
}

export function displayNameForSpecies(species?: {
  commonName?: string | null;
  scientificName?: string | null;
  genus?: string | null;
  species?: string | null;
} | null) {
  if (!species) return null;
  return species.commonName?.trim()
    || species.scientificName?.trim()
    || [species.genus, species.species].filter(Boolean).join(" ").trim()
    || null;
}

export function defaultUnitForItemType(itemType: InventoryItemType) {
  if (itemType === "FISH") return "fish";
  if (itemType === "INVERT") return "inverts";
  if (itemType === "PLANT") return "plants";
  if (itemType === "EQUIPMENT") return "items";
  return null;
}
