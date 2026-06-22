import type { HealthConditionCategory, HealthConditionEntityType, HealthConditionSeverity, HealthConditionStatus } from "@prisma/client";

export const conditionStatuses: HealthConditionStatus[] = ["WATCHING", "ACTIVE", "TREATING", "IMPROVING", "WORSENING", "RESOLVED", "ARCHIVED"];
export const activeConditionStatuses: HealthConditionStatus[] = ["WATCHING", "ACTIVE", "TREATING", "IMPROVING", "WORSENING"];
export const conditionSeverities: HealthConditionSeverity[] = ["INFO", "LOW", "MODERATE", "HIGH", "CRITICAL"];
export const conditionCategories: HealthConditionCategory[] = ["WATER_QUALITY", "ALGAE", "DISEASE", "PARASITE", "PLANT_HEALTH", "BEHAVIOR", "INJURY", "EQUIPMENT", "MAINTENANCE", "UNKNOWN", "OTHER"];
export const conditionEntityTypes: HealthConditionEntityType[] = ["AQUARIUM", "INVENTORY_ITEM", "SPECIES", "EQUIPMENT", "PLANT", "FISH", "INVERT", "CORAL", "SYSTEM", "OTHER"];

export const conditionTypesByCategory: Record<HealthConditionCategory, string[]> = {
  WATER_QUALITY: ["Cloudy water", "Surface film", "Parameter instability", "Unexplained livestock losses"],
  ALGAE: ["Cyanobacteria", "Green water / algae bloom", "Black beard algae", "Hair algae", "Diatoms", "Algae on leaves"],
  DISEASE: ["Columnaris-like symptoms", "Fin rot", "Fungus-like growth", "Lethargy", "Clamped fins", "Labored breathing", "Bloating", "Stringy feces"],
  PARASITE: ["Ich / white spot", "Flashing", "Pest suspected"],
  PLANT_HEALTH: ["Plant melt", "Pinholes", "Chlorosis", "Necrosis", "Stunted growth", "Rhizome rot", "Nutrient deficiency suspected"],
  BEHAVIOR: ["Lethargy", "Flashing", "Clamped fins", "Labored breathing", "Polyps closed"],
  INJURY: ["Injury / aggression", "Failed molt", "Shell erosion", "Tissue recession", "Bleaching", "Mortality cluster"],
  EQUIPMENT: ["Filter rattling", "Reduced flow", "Light flickering", "Heater drift", "Pump noise", "Leak", "Sensor unreliable", "Controller offline"],
  MAINTENANCE: ["Maintenance needed", "Reduced performance", "Inspection needed"],
  UNKNOWN: ["Unknown condition"],
  OTHER: ["Other"]
};

export function severityPriority(severity: HealthConditionSeverity) {
  if (severity === "CRITICAL") return "CRITICAL" as const;
  if (severity === "HIGH") return "HIGH" as const;
  if (severity === "INFO" || severity === "LOW") return "LOW" as const;
  return "NORMAL" as const;
}

export function conditionLabel(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}
