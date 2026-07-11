import { mkdir, writeFile } from "fs/promises";
import path from "path";
import type { AiProvider, TankAiInput } from "@/domains/ai/providers/types";
import { eddySystemPrompt } from "@/domains/ai/prompts/eddy";
import { careAdvicePrompt, statusSummaryPrompt } from "@/domains/ai/prompts/care-advice";
import { coverImagePrompt } from "@/domains/ai/prompts/image-generation";
import { moderationPrompt } from "@/domains/ai/prompts/moderation";
import { coverConceptPrompt, tankNamePrompt } from "@/domains/ai/prompts/tank-identity";
import { troubleshootingPrompt } from "@/domains/ai/prompts/troubleshooting";

const RESPONSES_URL = "https://api.openai.com/v1/responses";
const CHAT_URL = "https://api.openai.com/v1/chat/completions";
const IMAGES_URL = "https://api.openai.com/v1/images/generations";
const MODERATIONS_URL = "https://api.openai.com/v1/moderations";

function apiKey() {
  return process.env.OPENAI_API_KEY;
}

function responsesModel() {
  return process.env.OPENAI_DEFAULT_RESPONSES_MODEL || process.env.OPENAI_DEFAULT_CHAT_MODEL || "gpt-4.1-mini";
}

function chatModel() {
  return process.env.OPENAI_DEFAULT_CHAT_MODEL || process.env.OPENAI_DEFAULT_RESPONSES_MODEL || "gpt-4.1-mini";
}

function coverImageModel() {
  const model = process.env.OPENAI_COVER_IMAGE_MODEL || process.env.OPENAI_IMAGE_MODEL || "gpt-image-1-mini";
  if (!model.trim()) throw new Error("OPENAI_COVER_IMAGE_MODEL must be configured for OpenAI cover image generation.");
  return model;
}

function coverImageSize() {
  const size = process.env.OPENAI_COVER_IMAGE_SIZE || "1024x1024";
  const supported = new Set(["1024x1024", "1024x1536", "1536x1024", "auto"]);
  if (!supported.has(size)) throw new Error(`OPENAI_COVER_IMAGE_SIZE "${size}" is not supported. Use 1024x1024, 1024x1536, 1536x1024, or auto.`);
  return size;
}

function coverImageQuality() {
  const quality = process.env.OPENAI_COVER_IMAGE_QUALITY || "low";
  const supported = new Set(["low", "medium", "high", "auto", "standard", "hd"]);
  if (!supported.has(quality)) throw new Error(`OPENAI_COVER_IMAGE_QUALITY "${quality}" is not supported. Use low, medium, high, auto, standard, or hd.`);
  return quality;
}

function moderationModel() {
  return process.env.OPENAI_MODERATION_MODEL || "omni-moderation-latest";
}

function openAiErrorMessage(status: number, payload: any, context: string) {
  const message = payload?.error?.message || `OpenAI request failed with ${status}`;
  const code = payload?.error?.code;
  const lowered = String(message).toLowerCase();
  if (status === 401) return "OpenAI API key was rejected. Check OPENAI_API_KEY for the Fluxpoint server.";
  if (status === 403 && (lowered.includes("verify") || lowered.includes("verification") || lowered.includes("organization"))) {
    return "OpenAI organization verification is required before Fluxpoint can generate cover images with the Images API.";
  }
  if (status === 404 || code === "model_not_found" || lowered.includes("model")) {
    return `OpenAI ${context} failed because the configured model is unavailable or unsupported: ${message}`;
  }
  return `OpenAI ${context} failed: ${message}`;
}

async function openAiFetch(url: string, body: unknown, context = "request") {
  const key = apiKey();
  if (!key) throw new Error("OPENAI_API_KEY is required when AI_PROVIDER=openai.");
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(openAiErrorMessage(response.status, payload, context));
  if (payload && typeof payload === "object") payload._requestId = response.headers.get("x-request-id") || response.headers.get("request-id") || null;
  return payload;
}

async function imageResultBuffer(image: any) {
  const base64 = image?.b64_json;
  if (base64) return Buffer.from(base64, "base64");
  const url = typeof image?.url === "string" ? image.url : null;
  if (!url) return null;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`OpenAI Images API returned an image URL, but Fluxpoint could not download it (${response.status}).`);
  return Buffer.from(await response.arrayBuffer());
}

function extractText(payload: any) {
  if (payload.output_text) return payload.output_text;
  const message = payload.output?.flatMap((item: any) => item.content ?? []).find((content: any) => content.type === "output_text" || content.text);
  return message?.text ?? "";
}

function parseJson<T>(text: string, fallback: T): T {
  try {
    const start = text.indexOf("{");
    const arrayStart = text.indexOf("[");
    const index = arrayStart !== -1 && (start === -1 || arrayStart < start) ? arrayStart : start;
    const end = text.lastIndexOf(index === arrayStart ? "]" : "}");
    return JSON.parse(text.slice(index, end + 1)) as T;
  } catch {
    return fallback;
  }
}

async function structuredJson<T>(prompt: string, fallback: T): Promise<T> {
  try {
    const payload = await openAiFetch(RESPONSES_URL, {
      model: responsesModel(),
      input: [
        { role: "system", content: eddySystemPrompt() },
        { role: "user", content: prompt }
      ],
      temperature: 0.4
    });
    return parseJson(extractText(payload), fallback);
  } catch (error) {
    const payload = await openAiFetch(CHAT_URL, {
      model: chatModel(),
      messages: [
        { role: "system", content: eddySystemPrompt() },
        { role: "user", content: prompt }
      ],
      temperature: 0.4
    });
    return parseJson(payload.choices?.[0]?.message?.content ?? "", fallback);
  }
}

export const openAiProvider: AiProvider = {
  name: "openai",
  configured() {
    return Boolean(apiKey());
  },
  async generateTankNames(input: TankAiInput) {
    return structuredJson(tankNamePrompt(input), []);
  },
  async generateCoverCardConcepts(input: TankAiInput) {
    return structuredJson(coverConceptPrompt(input), []);
  },
  async generateCareAdvice(input: TankAiInput) {
    return structuredJson(careAdvicePrompt(input), { title: "Eddy note", summary: "No advice returned.", checklist: [] });
  },
  async generateTroubleshootingQuestions(input: TankAiInput) {
    return structuredJson(troubleshootingPrompt(input), { title: "Troubleshooting questions", questions: [] });
  },
  async summarizeAquariumStatus(input: TankAiInput) {
    return structuredJson(statusSummaryPrompt(input), { title: "Aquarium status", summary: "No summary returned.", signals: [] });
  },
  async generateTankCoverImage(input: TankAiInput) {
    if (!apiKey()) throw new Error("OPENAI_API_KEY is required for OpenAI Images API cover generation.");
    const prompt = coverImagePrompt(input);
    const moderation = await this.moderateText({ text: prompt, inputType: "PROMPT", collectionId: input.collectionId, userId: input.userId, entityType: "Aquarium", entityId: input.aquariumId });
    if (moderation.blocked) throw new Error(moderation.reason || "Image prompt was blocked by moderation.");
    const model = coverImageModel();
    const size = coverImageSize();
    const quality = coverImageQuality();
    const payload = await openAiFetch(IMAGES_URL, {
      model,
      prompt,
      size,
      quality
    }, "Images API cover generation");
    const image = payload.data?.[0];
    const buffer = await imageResultBuffer(image);
    if (!buffer?.length) throw new Error("OpenAI Images API returned no usable image data for the generated cover.");
    const filename = `ai-cover-${Date.now()}-${Math.random().toString(16).slice(2)}.png`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", "ai");
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, filename), buffer);
    console.log("Fluxpoint OpenAI Images API request completed", { model, endpoint: "images.generations", size, quality, providerRequestId: payload._requestId ?? null });
    return {
      url: `/uploads/ai/${filename}`,
      filename,
      prompt,
      providerCallType: "IMAGE",
      model,
      generatedAt: new Date().toISOString(),
      source: "AI",
      endpoint: "images.generations",
      size,
      quality
      ,providerRequestId: payload._requestId ?? null
    };
  },
  async moderateText(input) {
    const payload = await openAiFetch(MODERATIONS_URL, {
      model: moderationModel(),
      input: moderationPrompt(input.text)
    });
    const result = payload.results?.[0] ?? {};
    const flagged = Boolean(result.flagged);
    return {
      allowed: !flagged,
      flagged,
      blocked: flagged,
      categories: result.categories,
      scores: result.category_scores,
      reason: flagged ? "OpenAI moderation flagged this content." : undefined
    };
  },
  async moderateImage(input) {
    const imageUrl = input.dataUrl || input.url;
    if (!imageUrl) throw new Error("Image moderation requires image data.");
    const payload = await openAiFetch(MODERATIONS_URL, {
      model: moderationModel(),
      input: [
        { type: "text", text: "Classify this aquarium photo for unsafe, sexual, graphic, hateful, harassing, violent, self-harm, or illicit content." },
        { type: "image_url", image_url: { url: imageUrl } }
      ]
    });
    const result = payload.results?.[0];
    if (!result || typeof result.flagged !== "boolean") throw new Error("OpenAI moderation returned an unreadable result.");
    const flagged = Boolean(result.flagged);
    return { allowed: !flagged, flagged, blocked: flagged, categories: result.categories, scores: result.category_scores, reason: flagged ? "OpenAI moderation flagged this image." : "OpenAI moderation approved this image." };
  }
};
