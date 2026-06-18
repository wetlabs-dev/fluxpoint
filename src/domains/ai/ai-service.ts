import { mockAiProvider } from "@/domains/ai/providers/mock-provider";
import { openAiProvider } from "@/domains/ai/providers/openai-provider";
import type { AiProvider, TankAiInput } from "@/domains/ai/providers/types";
import { prisma } from "@/lib/db/prisma";
import type { AiRequestType } from "@prisma/client";

export type { TankAiInput } from "@/domains/ai/providers/types";

function getProvider(): AiProvider {
  const provider = process.env.AI_PROVIDER?.trim().toLowerCase() || "mock";
  if (provider === "openai") {
    if (openAiProvider.configured()) return openAiProvider;
    console.warn("Fluxpoint AI provider openai is selected but OPENAI_API_KEY is missing; falling back to mock provider.");
    return mockAiProvider;
  }
  if (provider !== "mock") console.warn(`Fluxpoint AI provider "${provider}" is not recognized; falling back to mock provider.`);
  return mockAiProvider;
}

export function aiProviderStatus() {
  const requestedProvider = process.env.AI_PROVIDER?.trim().toLowerCase() || "mock";
  const provider = getProvider();
  return {
    provider: provider.name,
    requestedProvider,
    configured: provider.configured(),
    enabled: process.env.AI_ENABLED !== "false",
    responsesModel: process.env.OPENAI_DEFAULT_RESPONSES_MODEL || process.env.OPENAI_DEFAULT_CHAT_MODEL || null,
    imageModel: process.env.OPENAI_IMAGE_MODEL || null,
    moderationModel: process.env.OPENAI_MODERATION_MODEL || null,
    fallbackActive: requestedProvider !== provider.name
  };
}

async function logAiRequest<T>(requestType: AiRequestType, input: TankAiInput, run: (provider: AiProvider) => Promise<T>) {
  const provider = getProvider();
  const startedAt = Date.now();
  const log = await prisma.aiRequestLog.create({
    data: {
      collectionId: input.collectionId ?? null,
      aquariumId: input.aquariumId ?? null,
      userId: input.userId ?? null,
      requestType,
      provider: provider.name,
      model: provider.name === "openai" ? process.env.OPENAI_DEFAULT_RESPONSES_MODEL || process.env.OPENAI_DEFAULT_CHAT_MODEL || null : null,
      promptSummary: input.name ? `Aquarium: ${input.name}` : null,
      input: input as never
    }
  });

  try {
    const output = await run(provider);
    await prisma.aiRequestLog.update({
      where: { id: log.id },
      data: {
        status: "SUCCEEDED",
        output: output as never,
        completedAt: new Date()
      }
    });
    console.log("Fluxpoint AI request completed", { id: log.id, requestType, provider: provider.name, ms: Date.now() - startedAt });
    return output;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.aiRequestLog.update({
      where: { id: log.id },
      data: { status: "FAILED", error: message, completedAt: new Date() }
    });
    console.error("Fluxpoint AI request failed", { id: log.id, requestType, provider: provider.name, error: message });
    throw error;
  }
}

export async function generateTankNames(input: TankAiInput) {
  return logAiRequest("TANK_NAME", input, (provider) => provider.generateTankNames(input));
}

export async function generateCoverCardConcepts(input: TankAiInput) {
  return logAiRequest("COVER_CARD", input, (provider) => provider.generateCoverCardConcepts(input));
}

export async function generateCareAdvice(input: TankAiInput) {
  return logAiRequest("CARE_ADVICE", input, (provider) => provider.generateCareAdvice(input));
}

export async function generateTroubleshootingQuestions(input: TankAiInput) {
  return logAiRequest("TROUBLESHOOTING", input, (provider) => provider.generateTroubleshootingQuestions(input));
}

export async function summarizeAquariumStatus(input: TankAiInput) {
  return logAiRequest("SUMMARY", input, (provider) => provider.summarizeAquariumStatus(input));
}

export async function generateTankCoverImage(input: TankAiInput) {
  const moderation = await moderateText({
    text: JSON.stringify({
      name: input.name,
      tankType: input.tankType,
      stocking: input.stocking,
      plants: input.plants,
      hardscape: input.hardscape,
      vibeNotes: input.vibeNotes,
      colorNotes: input.colorNotes
    }),
    inputType: "PROMPT",
    collectionId: input.collectionId,
    userId: input.userId,
    entityType: "Aquarium",
    entityId: input.aquariumId
  });
  if (moderation.blocked) throw new Error(moderation.reason || "The cover image prompt was blocked by moderation.");
  return logAiRequest("IMAGE_GENERATION", input, (provider) => provider.generateTankCoverImage(input));
}

export async function moderateText(input: {
  text: string;
  inputType?: "TEXT" | "PROMPT";
  collectionId?: string | null;
  userId?: string | null;
  entityType?: string;
  entityId?: string | null;
}) {
  const provider = getProvider();
  const result = await provider.moderateText(input);
  await prisma.moderationReview.create({
    data: {
      collectionId: input.collectionId ?? null,
      userId: input.userId ?? null,
      entityType: input.entityType ?? "AI_PROMPT",
      entityId: input.entityId ?? null,
      provider: provider.name,
      model: provider.name === "openai" ? process.env.OPENAI_MODERATION_MODEL || null : null,
      inputType: input.inputType ?? "TEXT",
      status: result.blocked ? "BLOCKED" : result.flagged ? "FLAGGED" : "ALLOWED",
      categories: result.categories as never,
      scores: result.scores as never,
      notes: result.reason ?? null
    }
  });
  return result;
}

export async function moderateImage(input: {
  url?: string;
  filename?: string;
  collectionId?: string | null;
  userId?: string | null;
  entityType?: string;
  entityId?: string | null;
}) {
  const provider = getProvider();
  const result = await provider.moderateImage(input);
  await prisma.moderationReview.create({
    data: {
      collectionId: input.collectionId ?? null,
      userId: input.userId ?? null,
      entityType: input.entityType ?? "IMAGE_UPLOAD",
      entityId: input.entityId ?? null,
      provider: provider.name,
      model: provider.name === "openai" ? process.env.OPENAI_MODERATION_MODEL || null : null,
      inputType: "IMAGE",
      status: result.blocked ? "BLOCKED" : result.flagged ? "FLAGGED" : "ALLOWED",
      categories: result.categories as never,
      scores: result.scores as never,
      notes: result.reason ?? null
    }
  });
  return result;
}
