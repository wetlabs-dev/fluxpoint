import { mockAiProvider } from "@/domains/ai/providers/mock-provider";
import { openAiProvider } from "@/domains/ai/providers/openai-provider";
import type { AiProvider, TankAiInput } from "@/domains/ai/providers/types";
import { prisma } from "@/lib/db/prisma";
import type { AiRequestType } from "@prisma/client";
import type { EddyFeatureKey } from "@/domains/eddy/eddy-features";
import { EddyFeatureDisabledError, EddyRateLimitError, assertEddyRateLimit, incrementEddyUsage } from "@/domains/eddy/rate-limits";
import { createAuditLog } from "@/domains/audit/audit-service";

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
  const aiEnabled = process.env.AI_ENABLED !== "false";
  const imageConfigEnabled = process.env.AI_IMAGE_ENABLED !== "false";
  const openAiImageReady = provider.name === "openai" && Boolean(process.env.OPENAI_API_KEY);
  const mockImageReady = provider.name === "mock" && requestedProvider !== "openai";
  return {
    provider: provider.name,
    requestedProvider,
    configured: provider.configured(),
    enabled: aiEnabled,
    imageEnabled: aiEnabled && imageConfigEnabled && (openAiImageReady || mockImageReady),
    moderationEnabled: aiEnabled && process.env.AI_MODERATION_ENABLED !== "false",
    responsesModel: process.env.OPENAI_DEFAULT_RESPONSES_MODEL || process.env.OPENAI_DEFAULT_CHAT_MODEL || null,
    imageModel: provider.name === "openai" ? process.env.OPENAI_IMAGE_MODEL || "gpt-image-1" : null,
    moderationModel: process.env.OPENAI_MODERATION_MODEL || null,
    fallbackActive: requestedProvider !== provider.name
  };
}

async function logAiRequest<T>(requestType: AiRequestType, input: TankAiInput, run: (provider: AiProvider) => Promise<T>, featureKey?: EddyFeatureKey) {
  const provider = getProvider();
  const startedAt = Date.now();
  const log = await prisma.aiRequestLog.create({
    data: {
      collectionId: input.collectionId ?? null,
      aquariumId: input.aquariumId ?? null,
      userId: input.userId ?? null,
      requestType,
      featureKey: featureKey ?? null,
      provider: provider.name,
      model: provider.name === "openai" ? requestType === "IMAGE_GENERATION" ? process.env.OPENAI_IMAGE_MODEL || "gpt-image-1" : process.env.OPENAI_DEFAULT_RESPONSES_MODEL || process.env.OPENAI_DEFAULT_CHAT_MODEL || null : null,
      promptSummary: input.name ? `Aquarium: ${input.name}` : null,
      input: input as never
    }
  });
  await createAuditLog({ collectionId: input.collectionId, entityType: "AiRequestLog", entityId: log.id, action: requestType === "IMAGE_GENERATION" ? "IMAGE_GENERATION_REQUESTED" : "AI_REQUEST_CREATED", summary: `${requestType.replaceAll("_", " ").toLowerCase()} requested`, actorUserId: input.userId, metadata: { requestType, featureKey, provider: provider.name, aquariumId: input.aquariumId } });

  try {
    if (featureKey) {
      if (!input.userId || !input.collectionId) throw new Error("Authenticated user and collection context are required for Eddy usage.");
      if (requestType === "IMAGE_GENERATION") await assertEddyRateLimit({ userId: input.userId, collectionId: input.collectionId, featureKey });
      else await incrementEddyUsage({ userId: input.userId, collectionId: input.collectionId, featureKey, requestLogId: log.id });
    }
    await prisma.aiRequestLog.update({ where: { id: log.id }, data: { providerAttempted: true } });
    const output = await run(provider);
    if (featureKey && requestType === "IMAGE_GENERATION" && input.userId && input.collectionId) {
      await incrementEddyUsage({ userId: input.userId, collectionId: input.collectionId, featureKey, requestLogId: log.id });
    }
    await prisma.aiRequestLog.update({
      where: { id: log.id },
      data: {
        status: "SUCCEEDED",
        output: output as never,
        imageCount: requestType === "IMAGE_GENERATION" ? 1 : 0,
        completedAt: new Date()
      }
    });
    await createAuditLog({ collectionId: input.collectionId, entityType: "AiRequestLog", entityId: log.id, action: requestType === "IMAGE_GENERATION" ? "IMAGE_GENERATION_SUCCEEDED" : "AI_REQUEST_SUCCEEDED", summary: `${requestType.replaceAll("_", " ").toLowerCase()} succeeded`, actorUserId: input.userId, metadata: { requestType, featureKey, provider: provider.name, durationMs: Date.now() - startedAt } });
    console.log("Fluxpoint AI request completed", { id: log.id, requestType, provider: provider.name, providerCallType: requestType === "IMAGE_GENERATION" ? "IMAGE" : "TEXT", ms: Date.now() - startedAt });
    return output;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const blocked = error instanceof EddyRateLimitError || error instanceof EddyFeatureDisabledError;
    await prisma.aiRequestLog.update({
      where: { id: log.id },
      data: { status: blocked ? "BLOCKED" : "FAILED", error: message, completedAt: new Date() }
    });
    await createAuditLog({ collectionId: input.collectionId, entityType: "AiRequestLog", entityId: log.id, action: error instanceof EddyRateLimitError ? "AI_RATE_LIMIT_REACHED" : requestType === "IMAGE_GENERATION" ? "IMAGE_GENERATION_FAILED" : "AI_REQUEST_FAILED", summary: `${requestType.replaceAll("_", " ").toLowerCase()} ${blocked ? "was blocked" : "failed"}`, actorUserId: input.userId, severity: "WARNING", details: { requestType, featureKey, provider: provider.name, error: message } });
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
  return logAiRequest("IMAGE_GENERATION", input, async (provider) => {
    const moderation = await moderateText({
      text: JSON.stringify({ name: input.name, tankType: input.tankType, stocking: input.stocking, plants: input.plants, hardscape: input.hardscape, vibeNotes: input.vibeNotes, colorNotes: input.colorNotes }),
      inputType: "PROMPT",
      collectionId: input.collectionId,
      userId: input.userId,
      entityType: "Aquarium",
      entityId: input.aquariumId
    });
    if (moderation.blocked) throw new Error(moderation.reason || "The cover image prompt was blocked by moderation.");
    return provider.generateTankCoverImage(input);
  }, "COVER_IMAGE_GENERATION");
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
  const review = await prisma.moderationReview.create({
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
  await createAuditLog({ collectionId: input.collectionId, entityType: "ModerationReview", entityId: review.id, action: result.blocked ? "MODERATION_FAILED" : "MODERATION_SUCCEEDED", summary: `${input.inputType === "PROMPT" ? "Prompt" : "Text"} moderation ${result.blocked ? "blocked content" : "completed"}`, actorUserId: input.userId, severity: result.blocked || result.flagged ? "WARNING" : "INFO", metadata: { provider: provider.name, status: review.status, entityType: input.entityType, entityId: input.entityId } });
  return result;
}

export async function moderateImage(input: {
  url?: string;
  dataUrl?: string;
  filename?: string;
  collectionId?: string | null;
  userId?: string | null;
  entityType?: string;
  entityId?: string | null;
}) {
  const provider = getProvider();
  const result = await provider.moderateImage(input);
  const review = await prisma.moderationReview.create({
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
  await createAuditLog({ collectionId: input.collectionId, entityType: "ModerationReview", entityId: review.id, action: result.blocked ? "MODERATION_FAILED" : "MODERATION_SUCCEEDED", summary: `Image moderation ${result.blocked ? "blocked content" : "completed"}`, actorUserId: input.userId, severity: result.blocked || result.flagged ? "WARNING" : "INFO", metadata: { provider: provider.name, status: review.status, entityType: input.entityType, entityId: input.entityId } });
  return result;
}
