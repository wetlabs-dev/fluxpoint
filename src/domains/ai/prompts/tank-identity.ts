import type { TankAiInput } from "@/domains/ai/providers/types";
import { aquariumContext } from "@/domains/ai/prompts/current-keeper";

export function tankNamePrompt(input: TankAiInput) {
  return `Generate 5 cozy aquarium display names as JSON array [{"name":"","rationale":""}]. Context: ${JSON.stringify(aquariumContext(input))}`;
}

export function coverConceptPrompt(input: TankAiInput) {
  return `Generate 2 Fluxpoint cover-card style concepts as JSON array. Each item must include palette string array, mood, motif, typographyStyle, backgroundType, accentIllustrations string array, promptText. Context: ${JSON.stringify(aquariumContext(input))}`;
}
