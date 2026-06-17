import type { CoverCardStyle } from "@/lib/design/cover-card";

export type TankAiInput = {
  name?: string | null;
  volumeGallons?: number | null;
  tankType?: string | null;
  stocking?: string[];
  plants?: string[];
  hardscape?: string[];
  substrate?: string | null;
  lighting?: string | null;
  colorNotes?: string | null;
  vibeNotes?: string | null;
};

export async function generateTankNames(input: TankAiInput) {
  const base = input.tankType === "SALTWATER" ? ["Reef", "Tide", "Cove"] : ["Drift", "Moss", "Brook"];
  return [
    `${base[0]}haven`,
    `${base[1]}glow`,
    `${base[2]}mere`,
    "Springhollow",
    "Duskbrook"
  ].map((name, index) => ({
    name,
    rationale: index === 0 ? "Balances aquatic movement with a calm display-tank feel." : "A soft generated option ready for provider-backed expansion."
  }));
}

export async function generateCoverCardConcepts(input: TankAiInput): Promise<CoverCardStyle[]> {
  const freshwater = input.tankType !== "SALTWATER";
  return [
    {
      palette: freshwater ? ["#123f46", "#6f9673", "#d5bd84"] : ["#102f4e", "#4fa7b8", "#e3c982"],
      mood: "cozy current with filtered morning light",
      motif: freshwater ? "vallisneria, moss tufts, rounded river stones" : "reef ledges, soft polyps, moonlit water",
      typographyStyle: "warm editorial serif",
      backgroundType: "layered aquarium gradient",
      accentIllustrations: freshwater ? ["stem plants", "sand ripple", "tiny bubbles"] : ["coral shelf", "light caustics"],
      promptText: `Create a soft cover card for ${input.name ?? "an aquarium"} with a botanical aquatic mood.`
    },
    {
      palette: ["#193c3d", "#88a78b", "#f0dfb2"],
      mood: "quiet evening maintenance journal",
      motif: "subtle waterline, botanical silhouettes, warm sand",
      typographyStyle: "clean rounded sans",
      backgroundType: "paper grain with water pattern",
      accentIllustrations: ["floating leaf shadows", "fine line bubbles"],
      promptText: "A calm illustrated aquarium journal card with practical readable overlays."
    }
  ];
}

export async function generateCareAdvice(input: TankAiInput) {
  return {
    title: "Current Keeper note",
    summary: `Keep ${input.name ?? "this aquarium"} on a steady weekly rhythm while the real AI provider is wired in.`,
    checklist: ["Review latest nitrate trend", "Confirm equipment flow", "Log visible livestock changes"]
  };
}
