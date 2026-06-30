export type CoverCardStyle = {
  id?: string;
  title?: string;
  description?: string;
  palette: string[];
  paletteNotes?: string;
  mood: string;
  tags?: string[];
  motif: string;
  compositionNotes?: string;
  typographyStyle: string;
  backgroundType: string;
  accentIllustrations: string[];
  promptText: string;
  promptDraft?: string;
  generationPrompt?: string;
  cautions?: string[];
  confidenceLabel?: string;
};

export function parseCoverStyle(value: unknown): CoverCardStyle {
  if (typeof value === "string") {
    try {
      return parseCoverStyle(JSON.parse(value));
    } catch {
      return parseCoverStyle(null);
    }
  }

  if (!value || typeof value !== "object") {
    return {
      palette: ["#0f4a56", "#74a892", "#d9bd7f"],
      title: "Quiet planted current",
      description: "A soft atmospheric cover direction grounded in the aquarium record.",
      mood: "quiet planted current",
      tags: ["aquarium", "calm", "waterline"],
      motif: "soft aquatic botanicals",
      typographyStyle: "warm editorial",
      backgroundType: "layered water gradient",
      accentIllustrations: ["vallisneria", "river stones"],
      promptText: "A cozy planted aquarium cover card with soft water movement."
    };
  }

  return value as CoverCardStyle;
}

export function coverGradient(style: CoverCardStyle) {
  const [a, b, c] = style.palette;
  return `linear-gradient(135deg, ${a ?? "#0f4a56"}, ${b ?? "#74a892"} 58%, ${c ?? "#d9bd7f"})`;
}
