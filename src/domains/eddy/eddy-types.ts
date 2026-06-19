export const eddyActions = [
  "ask",
  "tank-summary",
  "compatibility",
  "stocking-suggestions",
  "care-recommendations",
  "name-ideas",
  "cover-concepts",
  "troubleshooting",
  "husbandry-fill",
  "species"
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
  suggestions?: Array<{ name: string; detail: string; caution?: string }>;
  questions?: string[];
  fields?: Record<string, string | null>;
};

export type EddyAquariumContext = {
  kind: "aquarium";
  aquarium: Record<string, unknown>;
  profile: Record<string, unknown> | null;
  inhabitants: Array<Record<string, unknown>>;
  equipment: Array<Record<string, unknown>>;
  lighting: Array<Record<string, unknown>>;
  latestParameters: Array<Record<string, unknown>>;
  recentEvents: Array<Record<string, unknown>>;
  careTasks: Array<Record<string, unknown>>;
  husbandry: Array<Record<string, unknown>>;
  quarantine: Array<Record<string, unknown>>;
  medications: Array<Record<string, unknown>>;
};

export type EddySpeciesContext = {
  kind: "species";
  species: Record<string, unknown>;
  speciesType: string;
  requestedFields: Array<{ key: string; label: string }>;
  currentHusbandry: Record<string, unknown> | null;
};
