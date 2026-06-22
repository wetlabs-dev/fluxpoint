import { z } from "zod";

export const stockingPressureFlags = [
  "PLANT_ASSISTED",
  "HIGH_PLANT_MASS",
  "UNDER_FILTERED",
  "MULTI_FILTER_SUPPORT",
  "SPARSE_DATA",
  "ADULT_SIZE_UNCERTAIN",
  "JUVENILE_STOCK",
  "HEAVY_LIVEBEARER_LOAD",
  "LARGE_BODIED_FISH",
  "HIGH_SCHOOLING_COUNT",
  "SHRIMP_DOMINANT",
  "HIGH_WASTE_SPECIES",
  "LOW_FLOW_CONTEXT",
  "STOCK_MIX_COMPLEX",
  "OVERSTOCK_RISK_IF_MATURE"
] as const;

export const stockingPressureFlagSchema = z.enum(stockingPressureFlags);
export type StockingPressureFlag = z.infer<typeof stockingPressureFlagSchema>;

export const stockingPressureFlagLabels: Record<StockingPressureFlag, string> = {
  PLANT_ASSISTED: "Plant-assisted",
  HIGH_PLANT_MASS: "High plant mass",
  UNDER_FILTERED: "Under-filtered",
  MULTI_FILTER_SUPPORT: "Multi-filter support",
  SPARSE_DATA: "Sparse data",
  ADULT_SIZE_UNCERTAIN: "Adult size uncertain",
  JUVENILE_STOCK: "Juvenile stock",
  HEAVY_LIVEBEARER_LOAD: "Heavy livebearer load",
  LARGE_BODIED_FISH: "Large-bodied fish",
  HIGH_SCHOOLING_COUNT: "Large school",
  SHRIMP_DOMINANT: "Shrimp-dominant",
  HIGH_WASTE_SPECIES: "High-waste species",
  LOW_FLOW_CONTEXT: "Low-flow context",
  STOCK_MIX_COMPLEX: "Complex stock mix",
  OVERSTOCK_RISK_IF_MATURE: "Overstock risk at adult size"
};

export const stockingPressureFlagDescriptions: Record<StockingPressureFlag, string> = {
  PLANT_ASSISTED: "Saved plants provide modest nutrient uptake support.",
  HIGH_PLANT_MASS: "A substantial saved plant load may improve nutrient handling.",
  UNDER_FILTERED: "Saved filtration appears limited for the recorded livestock.",
  MULTI_FILTER_SUPPORT: "Multiple attached filters add processing capacity and resilience.",
  SPARSE_DATA: "Important volume, livestock, species, or filtration details are missing.",
  ADULT_SIZE_UNCERTAIN: "Adult body size is not clear from saved species records.",
  JUVENILE_STOCK: "Some livestock appears to be juvenile or grow-out stock.",
  HEAVY_LIVEBEARER_LOAD: "A large livebearer group materially increases waste and growth pressure.",
  LARGE_BODIED_FISH: "One or more saved species is commonly large-bodied.",
  HIGH_SCHOOLING_COUNT: "A large recorded school contributes meaningful combined pressure.",
  SHRIMP_DOMINANT: "Most recorded animals are low-impact shrimp.",
  HIGH_WASTE_SPECIES: "One or more saved species is commonly a higher-waste fish.",
  LOW_FLOW_CONTEXT: "Saved equipment or notes suggest limited circulation.",
  STOCK_MIX_COMPLEX: "Many distinct livestock groups make the estimate less straightforward.",
  OVERSTOCK_RISK_IF_MATURE: "Current young stock may create substantially more pressure at adult size."
};

export const stockingPressureLevelLabels = {
  UNKNOWN: "Unknown",
  VERY_LIGHT: "Very light",
  LIGHT: "Light",
  MODERATE: "Moderate",
  HEAVY: "Heavy",
  OVERSTOCKED: "Overstocked"
} as const;

export const stockingPressureConfidenceLabels = { LOW: "Low", MEDIUM: "Medium", HIGH: "High" } as const;
