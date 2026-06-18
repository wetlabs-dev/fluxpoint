import type { TankAiInput } from "@/domains/ai/providers/types";
import { aquariumContext } from "@/domains/ai/prompts/current-keeper";

export function troubleshootingPrompt(input: TankAiInput) {
  return `Return troubleshooting JSON {"title":"","questions":[""]}. Ask structured questions before giving advice. Context: ${JSON.stringify(aquariumContext(input))}`;
}
