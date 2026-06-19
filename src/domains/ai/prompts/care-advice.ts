import type { TankAiInput } from "@/domains/ai/providers/types";
import { aquariumContext } from "@/domains/ai/prompts/eddy";

export function careAdvicePrompt(input: TankAiInput) {
  return `Return care advice JSON {"title":"","summary":"","checklist":[""]}. Keep it practical and cautious. Context: ${JSON.stringify(aquariumContext(input))}`;
}

export function statusSummaryPrompt(input: TankAiInput) {
  return `Return aquarium status JSON {"title":"","summary":"","signals":[""]}. Use supplied readings/events only. Context: ${JSON.stringify(aquariumContext(input))}`;
}
