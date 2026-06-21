import type { AiProvider, TankAiInput } from "@/domains/ai/providers/types";

export const mockAiProvider: AiProvider = {
  name: "mock",
  configured() {
    return true;
  },
  async generateTankNames(input: TankAiInput) {
    const base = input.tankType?.includes("MARINE") || input.tankType === "SALTWATER" ? ["Reef", "Tide", "Cove"] : ["Drift", "Moss", "Brook"];
    return [
      `${base[0]}haven`,
      `${base[1]}glow`,
      `${base[2]}mere`,
      "Springhollow",
      "Duskbrook"
    ].map((name, index) => ({
      name,
      rationale: index === 0
        ? `Balances ${input.stocking?.[0] ?? "stocking"} with a calm display-tank feel.`
        : "A soft generated option ready for provider-backed expansion."
    }));
  },

  async generateCoverCardConcepts(input: TankAiInput) {
    const freshwater = !(input.tankType?.includes("MARINE") || input.tankType === "SALTWATER");
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
  },

  async generateCareAdvice(input: TankAiInput) {
    const latestNitrate = input.latestParameters?.find((reading) => reading.parameter === "NITRATE");
    return {
      title: "Eddy note",
      summary: `Keep ${input.name ?? "this aquarium"} on a steady rhythm; ${latestNitrate ? `latest nitrate is ${latestNitrate.value}${latestNitrate.unit}` : "log a fresh parameter set when you can"}.`,
      checklist: ["Review latest water readings", "Confirm feeding and equipment flow", "Log visible livestock or plant changes"]
    };
  },

  async generateTroubleshootingQuestions(input: TankAiInput) {
    return {
      title: "Troubleshooting questions",
      questions: [
        `What changed in ${input.name ?? "this tank"} in the last 72 hours?`,
        "Are ammonia, nitrite, nitrate, pH, and temperature freshly logged?",
        "Any new livestock, plants, hardscape, medication, or equipment changes?",
        "Are affected inhabitants eating, hiding, gasping, flashing, or isolating?"
      ]
    };
  },

  async summarizeAquariumStatus(input: TankAiInput) {
    return {
      title: `${input.name ?? "Aquarium"} status summary`,
      summary: `${input.stocking?.length ?? 0} livestock groups, ${input.plants?.length ?? 0} plant records, and ${input.latestParameters?.length ?? 0} latest readings are available for review.`,
      signals: [
        input.substrate ? `Substrate: ${input.substrate}` : "Substrate not selected",
        input.lighting ? `Lighting: ${input.lighting}` : "Lighting not selected",
        input.recentEvents?.[0] ? `Latest event: ${input.recentEvents[0].title}` : "No recent event context"
      ]
    };
  },

  async generateTankCoverImage(input: TankAiInput) {
    return {
      url: "",
      filename: "",
      prompt: `Mock Fluxpoint cover image for ${input.name ?? "aquarium"}`
    };
  },

  async moderateText() {
    return { allowed: true, flagged: false, blocked: false };
  },

  async moderateImage() {
    return { allowed: true, flagged: false, blocked: false };
  }
};
