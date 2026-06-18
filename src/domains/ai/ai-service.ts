import { mockAiProvider } from "@/domains/ai/providers/mock-provider";
import type { AiProvider, TankAiInput } from "@/domains/ai/providers/types";

export type { TankAiInput } from "@/domains/ai/providers/types";

function getProvider(): AiProvider {
  const provider = process.env.AI_PROVIDER?.trim().toLowerCase() || "mock";
  if (provider !== "mock") {
    console.warn(`Fluxpoint AI provider "${provider}" is not wired yet; falling back to mock provider.`);
  }
  return mockAiProvider;
}

export async function generateTankNames(input: TankAiInput) {
  return getProvider().generateTankNames(input);
}

export async function generateCoverCardConcepts(input: TankAiInput) {
  return getProvider().generateCoverCardConcepts(input);
}

export async function generateCareAdvice(input: TankAiInput) {
  return getProvider().generateCareAdvice(input);
}

export async function generateTroubleshootingQuestions(input: TankAiInput) {
  return getProvider().generateTroubleshootingQuestions(input);
}

export async function summarizeAquariumStatus(input: TankAiInput) {
  return getProvider().summarizeAquariumStatus(input);
}
