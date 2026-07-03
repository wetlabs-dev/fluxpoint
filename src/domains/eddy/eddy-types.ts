export const eddyActions = [
  "tank-summary",
  "compatibility",
  "stocking-suggestions",
  "care-recommendations",
  "name-ideas",
  "cover-concepts",
  "cover-image-generation",
  "troubleshooting",
  "husbandry-fill",
  "species-care-summary",
  "care-digest"
] as const;

export type EddyAction = (typeof eddyActions)[number];

export type EddyContextSource = {
  label: string;
  detail: string;
};

export type EddyResult = {
  title: string;
  summary: string;
  observations: string[];
  recommendations: string[];
  assumptions: string[];
  basedOn: EddyContextSource[];
  verdict?: "likely fit" | "caution" | "not recommended";
  suggestions?: Array<{
    id?: string;
    name: string;
    title?: string;
    detail: string;
    description?: string;
    caution?: string;
    cautions?: string[];
    tags?: string[];
    palette?: string[];
    paletteNotes?: string;
    mood?: string;
    motif?: string;
    compositionNotes?: string;
    promptText?: string;
    promptDraft?: string;
    generationPrompt?: string;
    confidenceLabel?: string;
  }>;
  questions?: string[];
  fields?: Record<string, string | null>;
  guideSummary?: string | null;
  careDifficulty?: string | null;
  usage?: import("@/domains/eddy/rate-limits").EddyUsageStatus;
};

export type EddyAquariumContext = {
  kind: "aquarium";
  aquarium: Record<string, unknown>;
  profile: Record<string, unknown> | null;
  inhabitants: Array<Record<string, unknown>>;
  additionalContents: Array<Record<string, unknown>>;
  equipment: Array<Record<string, unknown>>;
  lighting: Array<Record<string, unknown>>;
  latestParameters: Array<Record<string, unknown>>;
  recentEvents: Array<Record<string, unknown>>;
  careTasks: Array<Record<string, unknown>>;
  husbandry: Array<Record<string, unknown>>;
  quarantine: Array<Record<string, unknown>>;
  medications: Array<Record<string, unknown>>;
  stockingPressure: Record<string, unknown> | null;
};

export type EddySpeciesContext = {
  kind: "species";
  species: Record<string, unknown>;
  speciesType: string;
  requestedFields: Array<{ key: string; label: string }>;
  currentHusbandry: Record<string, unknown> | null;
};
