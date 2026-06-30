import type { AiProvider, TankAiInput } from "@/domains/ai/providers/types";
import { mkdir } from "fs/promises";
import path from "path";
import sharp from "sharp";

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
        id: "quiet-current",
        title: "Quiet Current",
        description: freshwater ? "A calm planted-water mood with rounded river stones and soft botanical silhouettes." : "A calm reef-current mood with moonlit ledges and restrained coral texture.",
        palette: freshwater ? ["#123f46", "#6f9673", "#d5bd84"] : ["#102f4e", "#4fa7b8", "#e3c982"],
        paletteNotes: "Deep teal water, living green, and warm sand highlights.",
        mood: "cozy current with filtered morning light",
        tags: freshwater ? ["planted", "river stones", "soft current"] : ["marine", "reef ledges", "moonlit"],
        motif: freshwater ? "vallisneria, moss tufts, rounded river stones" : "reef ledges, soft polyps, moonlit water",
        compositionNotes: "Wide atmospheric header with the visual weight in the lower third so title overlays remain readable.",
        typographyStyle: "warm editorial serif",
        backgroundType: "layered aquarium gradient",
        accentIllustrations: freshwater ? ["stem plants", "sand ripple", "tiny bubbles"] : ["coral shelf", "light caustics"],
        promptText: `Create a soft cover card for ${input.name ?? "an aquarium"} with a botanical aquatic mood.`,
        generationPrompt: `Atmospheric illustrated aquarium header for ${input.name ?? "an aquarium"} with ${freshwater ? "plants, river stones, warm sand, and quiet teal water" : "reef ledges, soft moonlit water, and calm marine blues"}. No text.`,
        cautions: [],
        confidenceLabel: "Best fit"
      },
      {
        id: "field-journal",
        title: "Field Journal",
        description: "A restrained aquarium logbook mood with waterline texture and practical, observational calm.",
        palette: ["#193c3d", "#88a78b", "#f0dfb2"],
        paletteNotes: "Ink green, moss, parchment, and soft highlight tones.",
        mood: "quiet evening maintenance journal",
        tags: ["journal", "waterline", "subtle"],
        motif: "subtle waterline, botanical silhouettes, warm sand",
        compositionNotes: "Textural full-width background with soft negative space for header copy.",
        typographyStyle: "clean rounded sans",
        backgroundType: "paper grain with water pattern",
        accentIllustrations: ["floating leaf shadows", "fine line bubbles"],
        promptText: "A calm illustrated aquarium journal card with practical readable overlays.",
        generationPrompt: "A calm aquarium journal-inspired header background with soft waterline texture, botanical silhouettes, warm sand, and fine bubbles. No text.",
        cautions: ["Conceptual; does not imply exact stocking."],
        confidenceLabel: "Safe abstract"
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
    const filename = `mock-ai-cover-${Date.now()}-${Math.random().toString(16).slice(2)}.png`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", "ai");
    await mkdir(uploadDir, { recursive: true });
    const svg = `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="water" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#0f4a56"/><stop offset="0.55" stop-color="#47b9bd"/><stop offset="1" stop-color="#d7c783"/></linearGradient>
        <radialGradient id="glow" cx="62%" cy="36%" r="58%"><stop stop-color="#e9ffff" stop-opacity="0.65"/><stop offset="1" stop-color="#06313a" stop-opacity="0"/></radialGradient>
      </defs>
      <rect width="1024" height="1024" fill="url(#water)"/>
      <rect width="1024" height="1024" fill="url(#glow)"/>
      <path d="M-80 700 C180 520 310 790 550 610 C760 450 850 545 1110 370 L1110 1024 L-80 1024 Z" fill="#062a31" opacity="0.38"/>
      <path d="M110 720 C240 640 315 675 440 600 M615 685 C725 610 795 640 925 565" fill="none" stroke="#e4ffff" stroke-width="18" stroke-linecap="round" opacity="0.38"/>
      <circle cx="212" cy="286" r="28" fill="#dffcff" opacity="0.38"/><circle cx="274" cy="230" r="16" fill="#dffcff" opacity="0.32"/><circle cx="804" cy="318" r="22" fill="#dffcff" opacity="0.3"/>
    </svg>`;
    await sharp(Buffer.from(svg)).png().toFile(path.join(uploadDir, filename));
    return {
      url: `/uploads/ai/${filename}`,
      filename,
      prompt: input.customPrompt || input.selectedConceptPrompt || `Mock Fluxpoint cover image for ${input.name ?? "aquarium"}`
    };
  },

  async moderateText() {
    return { allowed: true, flagged: false, blocked: false };
  },

  async moderateImage() {
    return { allowed: true, flagged: false, blocked: false };
  }
};
