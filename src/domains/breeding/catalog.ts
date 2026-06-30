import type {
  BreedingObservationType,
  BreedingParentConfidence,
  BreedingParentRole,
  BreedingProjectStatus,
  BreedingProjectType,
  BreedingQuantityType,
  BreedingTraitConfidence
} from "@prisma/client";

export const breedingProjectTypes: BreedingProjectType[] = ["MANAGED", "OPPORTUNISTIC", "COMMUNITY", "PROPAGATION"];
export const breedingProjectStatuses: BreedingProjectStatus[] = ["PLANNING", "ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"];
export const breedingParentRoles: BreedingParentRole[] = ["MALE", "FEMALE", "POLLEN", "SEED", "UNKNOWN", "COMMUNITY"];
export const breedingParentConfidences: BreedingParentConfidence[] = ["KNOWN", "CANDIDATE", "UNKNOWN", "COMMUNITY"];
export const breedingQuantityTypes: BreedingQuantityType[] = ["EXACT", "ESTIMATED", "RANGE"];
export const breedingObservationTypes: BreedingObservationType[] = ["GENERAL", "SPAWN", "EGGS", "HATCH", "BIRTH", "GROWTH", "MILESTONE", "TRAIT", "MEASUREMENT", "LOSS", "TRANSFER", "PHOTO", "NOTE"];
export const breedingTraitConfidences: BreedingTraitConfidence[] = ["LOW", "MEDIUM", "HIGH", "CONFIRMED"];

export const defaultBreedingStages = {
  fish: ["PAIRING", "SPAWNED", "EGGS", "HATCHED", "FREE_SWIMMING", "JUVENILE", "GROW_OUT", "GRADUATED"],
  livebearer: ["PREGNANT", "BORN", "GROW_OUT", "GRADUATED"],
  plant: ["FLOWERING", "POLLINATED", "SEED", "GERMINATED", "ESTABLISHED"],
  propagation: ["CUT", "ROOTING", "ESTABLISHED"]
} as const;

export function humanizeBreedingValue(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function defaultStageForProject(type: BreedingProjectType) {
  return type === "PROPAGATION" ? "CUT" : type === "COMMUNITY" ? "BORN" : "PAIRING";
}
