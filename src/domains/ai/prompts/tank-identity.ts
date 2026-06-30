import type { TankAiInput } from "@/domains/ai/providers/types";
import { aquariumContext } from "@/domains/ai/prompts/eddy";

export function tankNamePrompt(input: TankAiInput) {
  return `Generate 5 cozy aquarium display names as JSON array [{"name":"","rationale":""}]. Context: ${JSON.stringify(aquariumContext(input))}`;
}

export function coverConceptPrompt(input: TankAiInput) {
  return `Generate 3 selectable Fluxpoint aquarium cover image concepts as a JSON array. Each item must include: id, title, description, tags string array, palette string array of hex colors, paletteNotes, mood, motif, compositionNotes, typographyStyle, backgroundType, accentIllustrations string array, promptText, generationPrompt, cautions string array, confidenceLabel. Keep concepts grounded in the aquarium record. If stocking, plants, or hardscape are missing, make the image atmospheric/abstract instead of inventing specific animals or layouts. Context: ${JSON.stringify(aquariumContext(input))}`;
}
