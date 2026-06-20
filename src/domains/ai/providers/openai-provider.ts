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

function imageModel() {
  return process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
}

function moderationModel() {
  return process.env.OPENAI_MODERATION_MODEL || "omni-moderation-latest";
}

async function openAiFetch(url: string, body: unknown) {
  const key = apiKey();
  if (!key) throw new Error("OPENAI_API_KEY is required when AI_PROVIDER=openai.");
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify(body)
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || `OpenAI request failed with ${response.status}`);
  return payload;
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
    const prompt = coverImagePrompt(input);
    const moderation = await this.moderateText({ text: prompt, inputType: "PROMPT", collectionId: input.collectionId, userId: input.userId, entityType: "Aquarium", entityId: input.aquariumId });
    if (moderation.blocked) throw new Error(moderation.reason || "Image prompt was blocked by moderation.");
    const payload = await openAiFetch(IMAGES_URL, {
      model: imageModel(),
      prompt,
      size: "1024x1024"
    });
    const image = payload.data?.[0];
    const base64 = image?.b64_json;
    if (!base64) throw new Error("OpenAI image generation returned no image data.");
    const filename = `ai-cover-${Date.now()}-${Math.random().toString(16).slice(2)}.png`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", "ai");
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, filename), Buffer.from(base64, "base64"));
    return { url: `/uploads/ai/${filename}`, filename, prompt };
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
