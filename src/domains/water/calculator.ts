import type { WaterRecipeVolumeUnit } from "@prisma/client";

export type WaterRecipeCalculatorAdditive = {
  id: string;
  additiveName: string;
  doseAmount: number;
  doseUnit: string;
  perVolumeAmount: number;
  perVolumeUnit: WaterRecipeVolumeUnit | string;
  instructions?: string | null;
};

const LITERS_PER_GALLON = 3.78541;

export function convertRecipeVolume(amount: number, from: WaterRecipeVolumeUnit | string, to: WaterRecipeVolumeUnit | string) {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (from === to) return amount;
  if (from === "GALLON" && to === "LITER") return amount * LITERS_PER_GALLON;
  if (from === "LITER" && to === "GALLON") return amount / LITERS_PER_GALLON;
  return amount;
}

export function calculateRecipeDose(additive: WaterRecipeCalculatorAdditive, volumeAmount: number, volumeUnit: WaterRecipeVolumeUnit | string) {
  if (!Number.isFinite(volumeAmount) || volumeAmount <= 0 || additive.perVolumeAmount <= 0) return 0;
  const convertedVolume = convertRecipeVolume(volumeAmount, volumeUnit, additive.perVolumeUnit);
  return convertedVolume / additive.perVolumeAmount * additive.doseAmount;
}

export function formatDoseUnit(unit: string) {
  return unit.toLowerCase().replaceAll("_", " ");
}
