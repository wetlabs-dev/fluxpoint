export const eddyFeatureKeys = [
  "TANK_SUMMARY",
  "COMPATIBILITY_CHECK",
  "STOCKING_SUGGESTIONS",
  "CARE_RECOMMENDATIONS",
  "NAME_IDEAS",
  "COVER_CONCEPTS",
  "COVER_IMAGE_GENERATION",
  "TROUBLESHOOTING",
  "HUSBANDRY_MAGIC_FILL",
  "SPECIES_MAGIC_FILL",
  "SPECIES_CARE_SUMMARY",
  "CARE_DIGEST",
  "CONDITION_REVIEW"
] as const;

export type EddyFeatureKey = (typeof eddyFeatureKeys)[number];
export type EddyCostTier = "LOW" | "MEDIUM" | "HIGH";

export type EddyFeatureDefinition = {
  key: EddyFeatureKey;
  label: string;
  description: string;
  defaultDailyUserLimit: number;
  defaultDailyCollectionLimit: number;
  defaultMonthlyCollectionLimit: number;
  estimatedCostTier: EddyCostTier;
  requiresOpenAI: boolean;
  requiresImageModel: boolean;
  requiresModeration: boolean;
  enabledByDefault: boolean;
  actions: string[];
  userLimitEnv?: string;
  collectionLimitEnv?: string;
};

export const eddyFeatures: Record<EddyFeatureKey, EddyFeatureDefinition> = {
  TANK_SUMMARY: feature("TANK_SUMMARY", "Tank summaries", "Summarize the recorded state of an aquarium.", 10, 50, 500, "LOW", ["tank-summary"]),
  COMPATIBILITY_CHECK: feature("COMPATIBILITY_CHECK", "Compatibility checks", "Review a proposed species against a tank's records.", 10, 50, 500, "MEDIUM", ["compatibility"]),
  STOCKING_SUGGESTIONS: feature("STOCKING_SUGGESTIONS", "Stocking suggestions", "Suggest carefully scoped stocking ideas for a recorded goal.", 8, 40, 400, "MEDIUM", ["stocking-suggestions"]),
  CARE_RECOMMENDATIONS: feature("CARE_RECOMMENDATIONS", "Care recommendations", "Prioritize practical care from tasks, readings, and events.", 10, 50, 500, "LOW", ["care-recommendations"]),
  NAME_IDEAS: feature("NAME_IDEAS", "Tank name ideas", "Generate names and subtitles grounded in tank identity.", 12, 60, 600, "LOW", ["name-ideas"]),
  COVER_CONCEPTS: feature("COVER_CONCEPTS", "Cover concepts", "Draft palettes, motifs, and image prompts.", 6, 30, 300, "MEDIUM", ["cover-concepts"]),
  COVER_IMAGE_GENERATION: { ...feature("COVER_IMAGE_GENERATION", "Cover images", "Generate a moderated aquarium cover image.", 3, 10, 50, "HIGH", ["cover-image-generation"]), requiresOpenAI: true, requiresImageModel: true, requiresModeration: true, userLimitEnv: "EDDY_IMAGE_DAILY_USER_LIMIT", collectionLimitEnv: "EDDY_IMAGE_DAILY_COLLECTION_LIMIT" },
  TROUBLESHOOTING: feature("TROUBLESHOOTING", "Troubleshooting", "Generate careful questions without claiming a diagnosis.", 10, 50, 500, "LOW", ["troubleshooting"]),
  HUSBANDRY_MAGIC_FILL: { ...feature("HUSBANDRY_MAGIC_FILL", "Husbandry drafts", "Draft type-specific husbandry fields for review.", 10, 50, 500, "MEDIUM", ["husbandry-fill"]), userLimitEnv: "EDDY_HUSBANDRY_DAILY_USER_LIMIT" },
  SPECIES_MAGIC_FILL: { ...feature("SPECIES_MAGIC_FILL", "Species Magic Fill", "Draft a normalized species profile and useful aliases for review.", 6, 30, 300, "MEDIUM", ["species-magic-fill"]), userLimitEnv: "EDDY_SPECIES_MAGIC_FILL_DAILY_USER_LIMIT" },
  SPECIES_CARE_SUMMARY: feature("SPECIES_CARE_SUMMARY", "Species care summaries", "Summarize recorded species care needs.", 10, 50, 500, "LOW", ["species-care-summary"]),
  CARE_DIGEST: feature("CARE_DIGEST", "Care digests", "Summarize due and overdue care across a collection.", 10, 50, 500, "LOW", ["care-digest"]),
  CONDITION_REVIEW: feature("CONDITION_REVIEW", "Condition reviews", "Summarize a recorded condition and draft a conservative observation checklist.", 10, 50, 500, "LOW", ["condition-review"])
};

function feature(key: EddyFeatureKey, label: string, description: string, dailyUser: number, dailyCollection: number, monthlyCollection: number, estimatedCostTier: EddyCostTier, actions: string[]): EddyFeatureDefinition {
  return { key, label, description, defaultDailyUserLimit: dailyUser, defaultDailyCollectionLimit: dailyCollection, defaultMonthlyCollectionLimit: monthlyCollection, estimatedCostTier, requiresOpenAI: false, requiresImageModel: false, requiresModeration: false, enabledByDefault: true, actions };
}

export const eddyActionFeatureMap = Object.fromEntries(Object.values(eddyFeatures).flatMap((definition) => definition.actions.map((action) => [action, definition.key]))) as Record<string, EddyFeatureKey>;

export function featureForEddyAction(action: string) {
  return eddyActionFeatureMap[action];
}
