import type { AiRequestType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { aiProviderStatus } from "@/domains/ai/ai-service";
import { buildEddyAquariumContext, buildEddyPageContext, buildEddySpeciesContext } from "@/domains/eddy/eddy-context";
import { buildEddyPrompt, EDDY_SYSTEM_PROMPT } from "@/domains/eddy/eddy-prompts";
import type { EddyAction, EddyResult } from "@/domains/eddy/eddy-types";
import { featureForEddyAction } from "@/domains/eddy/eddy-features";
import { EddyFeatureDisabledError, EddyRateLimitError, incrementEddyUsage } from "@/domains/eddy/rate-limits";
import { auditCollectionAction } from "@/domains/audit/audit-service";

type EddyRequest = {
  action: EddyAction;
  userId: string;
  collectionId: string;
  aquariumId?: string | null;
  speciesDefinitionId?: string | null;
  page?: string;
  input?: Record<string, unknown>;
};

const requestTypes: Partial<Record<EddyAction, AiRequestType>> = {
  "tank-summary": "SUMMARY",
  compatibility: "COMPATIBILITY",
  "stocking-suggestions": "STOCKING",
  "care-recommendations": "CARE_ADVICE",
  "name-ideas": "TANK_NAME",
  "cover-concepts": "COVER_CARD",
  "cover-image-generation": "IMAGE_GENERATION",
  troubleshooting: "TROUBLESHOOTING",
  "husbandry-fill": "HUSBANDRY",
  "species-care-summary": "HUSBANDRY",
  "care-digest": "CARE_ADVICE"
};

export class EddyValidationError extends Error { status = 400; }

export function validateEddyInput(action: EddyAction, input: Record<string, unknown>) {
  if (action === "compatibility" && !String(input.proposal || "").trim()) throw new EddyValidationError("Enter a species or stocking idea to check.");
  if (action === "stocking-suggestions" && !String(input.goal || "").trim()) throw new EddyValidationError("Choose a stocking goal first.");
}

function cleanResult(value: Partial<EddyResult>, fallback: EddyResult): EddyResult {
  return {
    title: String(value.title || fallback.title),
    summary: String(value.summary || fallback.summary),
    observations: Array.isArray(value.observations) ? value.observations.map(String) : fallback.observations,
    recommendations: Array.isArray(value.recommendations) ? value.recommendations.map(String) : fallback.recommendations,
    assumptions: Array.isArray(value.assumptions) ? value.assumptions.map(String) : fallback.assumptions,
    basedOn: Array.isArray(value.basedOn) ? value.basedOn.map((source) => ({ label: String(source?.label || "Fluxpoint record"), detail: String(source?.detail || "Recorded app data") })) : fallback.basedOn,
    verdict: value.verdict,
    suggestions: Array.isArray(value.suggestions) ? value.suggestions.map((item) => ({
      id: item?.id ? String(item.id) : undefined,
      name: String(item?.name || item?.title || "Suggestion"),
      title: item?.title ? String(item.title) : undefined,
      detail: String(item?.detail || item?.description || ""),
      description: item?.description ? String(item.description) : undefined,
      ...(item?.caution ? { caution: String(item.caution) } : {}),
      cautions: Array.isArray(item?.cautions) ? item.cautions.map(String) : undefined,
      tags: Array.isArray(item?.tags) ? item.tags.map(String) : undefined,
      palette: Array.isArray(item?.palette) ? item.palette.map(String) : undefined,
      paletteNotes: item?.paletteNotes ? String(item.paletteNotes) : undefined,
      mood: item?.mood ? String(item.mood) : undefined,
      motif: item?.motif ? String(item.motif) : undefined,
      compositionNotes: item?.compositionNotes ? String(item.compositionNotes) : undefined,
      promptText: item?.promptText ? String(item.promptText) : undefined,
      promptDraft: item?.promptDraft ? String(item.promptDraft) : undefined,
      generationPrompt: item?.generationPrompt ? String(item.generationPrompt) : undefined,
      confidenceLabel: item?.confidenceLabel ? String(item.confidenceLabel) : undefined
    })) : fallback.suggestions,
    questions: Array.isArray(value.questions) ? value.questions.map(String) : fallback.questions,
    fields: value.fields && typeof value.fields === "object" ? Object.fromEntries(Object.entries(value.fields).map(([key, item]) => [key, item == null ? null : String(item)])) : fallback.fields
  };
}

function mockResult(request: EddyRequest, context: any): EddyResult {
  const name = context.kind === "aquarium" ? String(context.aquarium.name || "this aquarium") : context.kind === "species" ? String(context.species.commonName || "this species") : "this page";
  const basedOn = context.kind === "aquarium"
    ? [
        { label: "Tank profile", detail: `${context.aquarium.volumeGallons ?? "Unknown"} gallons · ${context.aquarium.tankType ?? "type not recorded"}` },
        { label: "Livestock and plants", detail: `${context.inhabitants.length} active record(s)` },
        { label: "Estimated lighting", detail: context.lighting.some((light: any) => light.estimatedDailyLightLoadLumenHours != null) ? `${Math.round(context.lighting.reduce((sum: number, light: any) => sum + Number(light.estimatedDailyLightLoadLumenHours || 0), 0)).toLocaleString()} lumen-hours relative daily load (not PAR)` : "No complete fixture-lumen and schedule estimate" },
        { label: "Recent records", detail: `${context.latestParameters.length} latest parameter(s), ${context.recentEvents.length} event(s), ${context.careTasks.length} open task(s)` }
      ]
    : context.kind === "species"
      ? [{ label: "Species definition", detail: `${name} · ${context.speciesType}` }, { label: "Husbandry registry", detail: `${context.requestedFields.length} type-specific fields` }]
      : [{ label: "Current page", detail: context.page }, { label: "Collection overview", detail: `${context.aquariums.length} aquarium(s), ${context.openTasks.length} open task(s), ${context.inventoryCount} active inventory item(s)` }];
  const overdue = context.kind === "aquarium" ? context.careTasks.filter((task: any) => new Date(task.dueAt) < new Date()).length : 0;
  const base: EddyResult = {
    title: `Eddy on ${name}`,
    summary: "I reviewed the available Fluxpoint records. This local Eddy response stays conservative where the record is incomplete.",
    observations: context.kind === "aquarium" ? [`${context.inhabitants.length} active livestock or plant record(s) are attached.`, `${context.latestParameters.length} parameter type(s) have a latest reading.`, overdue ? `${overdue} care task(s) appear overdue.` : "No overdue care tasks appear in the supplied context."] : context.kind === "species" ? ["The species definition and type-specific husbandry registry are available."] : [`${context.aquariums.length} aquarium(s) and ${context.inventoryCount} active inventory item(s) are in this collection.`, `${context.openTasks.length} open care task(s) are available for review.`],
    recommendations: ["Review the newest records before making a meaningful change.", "Log missing observations or water parameters so Eddy can narrow the next answer."],
    assumptions: context.kind === "aquarium" && !context.latestParameters.length ? ["No current water parameters were available."] : ["Mock provider output is a workflow preview, not a researched species determination."],
    basedOn
  };
  if (request.action === "compatibility") return { ...base, title: "Compatibility check", verdict: "caution", summary: `There is not enough provider-backed species evidence to confirm ${String(request.input?.proposal || "the proposal")}.`, recommendations: ["Confirm adult size, temperament, preferred group size, and temperature/pH/GH/KH overlap.", "Quarantine new livestock and observe current inhabitants carefully."], assumptions: ["The mock provider does not infer unrecorded species requirements."] };
  if (request.action === "stocking-suggestions") return { ...base, title: "Stocking ideas", suggestions: [{ name: "Record-first shortlist", detail: `For the ${String(request.input?.goal || "stated")} goal, shortlist species only after matching adult size and water ranges.`, caution: "Confirm group size, bioload, and temperament before purchase." }] };
  if (request.action === "name-ideas") return { ...base, title: "Tank identity ideas", suggestions: ["Stillwater Atlas", "Blue Hour", "Mosslight", "Quiet Current", "Riverglass"].map((idea) => ({ name: idea, detail: `A calm identity option for ${name}.` })) };
  if (request.action === "cover-concepts") return {
    ...base,
    title: "Cover concepts",
    summary: "Pick one direction, or write a custom prompt, before asking Eddy to generate the aquarium cover image.",
    suggestions: [
      {
        id: "quiet-current",
        name: "Quiet current",
        title: "Quiet current",
        detail: "Soft waterline atmosphere with restrained bubbles and plant silhouettes.",
        description: "A calm, abstract aquarium header that uses recorded tank identity without inventing specific livestock.",
        tags: ["calm", "waterline", "plants", "display"],
        palette: ["deep teal", "clear cyan", "warm sand"],
        paletteNotes: "Deep teal base with clear cyan highlights and a warm sand accent.",
        mood: "calm",
        motif: "soft waterline and subtle current",
        compositionNotes: "Wide header composition with negative space for readable aquarium text.",
        generationPrompt: `Wide aquarium cover art for ${name}: calm deep teal waterline, subtle current, restrained bubbles, soft plant silhouettes, polished modern app-header composition, no text or logo.`,
        confidenceLabel: "Best fit"
      },
      {
        id: "field-journal",
        name: "Field journal",
        title: "Field journal",
        detail: "Aquatic field-note look with fine linework and quiet naturalist texture.",
        description: "A keeper’s notebook-inspired concept that stays abstract where the tank record is incomplete.",
        tags: ["field notes", "naturalist", "linework", "subtle"],
        palette: ["ink green", "moss", "parchment"],
        paletteNotes: "Ink green and moss over a muted parchment glow.",
        mood: "observant",
        motif: "fine aquatic linework and specimen-note texture",
        compositionNotes: "Layered botanical/aquatic forms along the edges with an open center.",
        generationPrompt: `Wide aquarium cover art for ${name}: subtle aquatic field-journal texture, fine underwater plant linework, muted ink green and moss palette, abstract record-inspired design, no text or logo.`
      },
      {
        id: "blue-hour",
        name: "Blue hour",
        title: "Blue hour",
        detail: "Low-light caustics with a single bright focal shimmer.",
        description: "A moody aquarium-lighting direction that is safe when livestock and hardscape details are sparse.",
        tags: ["moody", "caustics", "low light", "shimmer"],
        palette: ["midnight blue", "electric cyan", "pearl"],
        paletteNotes: "Midnight blue field with electric cyan shimmer and pearl highlights.",
        mood: "moody",
        motif: "low-light caustics",
        compositionNotes: "Dark wide field with a single bright focal point and soft falloff.",
        generationPrompt: `Wide aquarium cover art for ${name}: moody blue-hour underwater caustics, midnight blue and electric cyan shimmer, one bright pearl focal glint, atmospheric abstract aquarium header, no text or logo.`
      }
    ]
  };
  if (request.action === "troubleshooting") return { ...base, title: "Troubleshooting questions", questions: ["What changed in the last 72 hours?", "Are temperature, ammonia, nitrite, nitrate, and pH freshly logged?", "Are affected animals eating, breathing normally, hiding, flashing, or isolating?", "Did equipment, food, livestock, plants, hardscape, or medication change recently?"], recommendations: ["Do not treat this as a diagnosis.", "For any medication, verify the product label and observe livestock carefully."] };
  if (request.action === "husbandry-fill" && context.kind === "species") return { ...base, title: "Eddy husbandry draft", fields: Object.fromEntries(context.requestedFields.map((field: any) => [field.key, mockHusbandryValue(field.key, context)])), recommendations: ["Review every field before saving; null means Eddy did not have enough reliable context."] };
  if (request.action === "care-recommendations") return { ...base, title: `Care plan for ${String(request.input?.timeframe || "this week")}`, recommendations: overdue ? ["Review overdue tasks first and record completion or a deliberate skip.", "Check recent parameters and observe livestock before changing routine."] : base.recommendations };
  if (request.action === "care-digest") return { ...base, title: `Care digest for ${String(request.input?.timeframe || "today")}`, summary: `${context.openTasks.length} open care task(s) and ${context.recentEvents.length} recent event(s) are available in the collection record.`, recommendations: context.openTasks.length ? ["Review the earliest due tasks first.", "Record completion or a deliberate skip so the care queue stays trustworthy."] : ["No open care tasks are recorded. Review schedules if you expected work to be due."] };
  if (request.action === "species-care-summary") return { ...base, title: `${name} care summary`, summary: "Eddy reviewed the species definition and current husbandry guide without filling missing facts.", recommendations: ["Review missing fields against a trusted species reference before marking the guide reviewed."] };
  return base;
}

function mockHusbandryValue(key: string, context: any) {
  const species = context.species ?? {};
  const current = context.currentHusbandry?.fields?.[key];
  if (typeof current === "string" && current.trim()) return current;
  const name = species.commonName || "this species";
  const temperature = Array.isArray(species.temperature) && species.temperature.some((value: unknown) => value != null) ? species.temperature.filter((value: unknown) => value != null).join("–") + " F" : null;
  const ph = Array.isArray(species.ph) && species.ph.some((value: unknown) => value != null) ? species.ph.filter((value: unknown) => value != null).join("–") : null;
  const gh = Array.isArray(species.gh) && species.gh.some((value: unknown) => value != null) ? species.gh.filter((value: unknown) => value != null).join("–") + " dGH" : null;
  const kh = Array.isArray(species.kh) && species.kh.some((value: unknown) => value != null) ? species.kh.filter((value: unknown) => value != null).join("–") + " dKH" : null;
  const map: Record<string, string | null> = {
    adultSize: typeof species.maxSize === "string" && species.maxSize ? species.maxSize : null,
    minimumGroupSize: species.minimumGroupSize != null ? String(species.minimumGroupSize) : null,
    temperatureRange: temperature,
    phRange: ph,
    ghRange: gh,
    khRange: kh,
    lightRequirement: typeof species.lightRequirement === "string" && species.lightRequirement ? species.lightRequirement : null,
    flowRequirement: typeof species.flowRequirement === "string" && species.flowRequirement ? species.flowRequirement : null,
    lifespan: null,
    temperament: "Review temperament against a trusted species source.",
    dietType: "Omnivore or species-appropriate prepared foods; verify for the exact species.",
    stapleFoods: "High-quality species-appropriate staple foods.",
    treatFoods: "Occasional varied foods if appropriate for the species.",
    feedingFrequency: "Small portions; adjust to observed condition and water quality.",
    compatibilityNotes: `Confirm adult size, temperament, and water-range overlap before mixing ${name}.`,
    quarantineNotes: "Quarantine new additions and observe appetite, respiration, and behavior before introduction.",
    commonIssues: "Watch for stress, injury, parasites, and water-quality related symptoms.",
    breedingNotes: "Research species-specific spawning behavior before attempting breeding.",
    generalNotes: "Mock Eddy draft; review and replace with source-backed husbandry details."
  };
  return map[key] ?? null;
}

async function runOpenAi(prompt: string, fallback: EddyResult) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: process.env.OPENAI_DEFAULT_RESPONSES_MODEL || process.env.OPENAI_DEFAULT_CHAT_MODEL || "gpt-4.1-mini", input: [{ role: "system", content: EDDY_SYSTEM_PROMPT }, { role: "user", content: prompt }], temperature: 0.3 })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || "Eddy provider request failed.");
  const text = payload.output_text ?? payload.output?.flatMap((item: any) => item.content ?? []).find((item: any) => item.text)?.text ?? "{}";
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return {
    result: cleanResult(JSON.parse(text.slice(start, end + 1)), fallback),
    tokensInput: Number(payload?.usage?.input_tokens ?? payload?.usage?.prompt_tokens ?? 0) || null,
    tokensOutput: Number(payload?.usage?.output_tokens ?? payload?.usage?.completion_tokens ?? 0) || null
  };
}

export async function runEddyRequest(request: EddyRequest) {
  validateEddyInput(request.action, request.input ?? {});
  const featureKey = featureForEddyAction(request.action);
  if (!featureKey || request.action === "cover-image-generation") throw new EddyValidationError("This Eddy tool uses a dedicated workflow.");
  const context = request.aquariumId
    ? await buildEddyAquariumContext(request.aquariumId, request.userId)
    : request.speciesDefinitionId
      ? await buildEddySpeciesContext(request.speciesDefinitionId, request.userId, String(request.input?.speciesType || "") || undefined)
      : await buildEddyPageContext(request.userId, request.page || "Fluxpoint");
  const prompt = buildEddyPrompt(request.action, context, request.input ?? {});
  const status = aiProviderStatus();
  const log = await prisma.aiRequestLog.create({ data: { collectionId: request.collectionId, aquariumId: request.aquariumId || null, speciesDefinitionId: request.speciesDefinitionId || null, userId: request.userId, requestType: requestTypes[request.action] ?? "OTHER", featureKey, provider: status.provider, model: status.responsesModel, promptSummary: `${request.action}: ${request.input?.proposal || request.input?.goal || request.page || "Fluxpoint context"}`.slice(0, 240), input: { action: request.action, input: request.input, page: request.page } as never } });
  await auditCollectionAction({ collectionId: request.collectionId, entityType: "AiRequestLog", entityId: log.id, action: "EDDY_REQUESTED", summary: `Eddy ${request.action.replaceAll("-", " ")} requested`, actorUserId: request.userId, metadata: { featureKey, provider: status.provider, aquariumId: request.aquariumId, speciesDefinitionId: request.speciesDefinitionId } });
  try {
    const usage = await incrementEddyUsage({ userId: request.userId, collectionId: request.collectionId, featureKey, requestLogId: log.id });
    await prisma.aiRequestLog.update({ where: { id: log.id }, data: { providerAttempted: true } });
    const fallback = mockResult(request, context);
    const providerResult = status.enabled && status.provider === "openai" && process.env.OPENAI_API_KEY ? await runOpenAi(prompt, fallback) : { result: fallback, tokensInput: null, tokensOutput: null };
    const result = providerResult.result;
    if (request.action === "husbandry-fill" && context.kind === "species") {
      result.fields = Object.fromEntries(context.requestedFields.map(({ key }) => [key, result.fields?.[key] ?? null]));
    }
    await prisma.aiRequestLog.update({ where: { id: log.id }, data: { status: "SUCCEEDED", output: result as never, tokensInput: providerResult.tokensInput, tokensOutput: providerResult.tokensOutput, completedAt: new Date() } });
    await auditCollectionAction({ collectionId: request.collectionId, entityType: "AiRequestLog", entityId: log.id, action: "EDDY_SUCCEEDED", summary: `Eddy ${request.action.replaceAll("-", " ")} succeeded`, actorUserId: request.userId, metadata: { featureKey, provider: status.provider, tokensInput: providerResult.tokensInput, tokensOutput: providerResult.tokensOutput } });
    return { ...result, usage, requestLogId: log.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const blocked = error instanceof EddyRateLimitError || error instanceof EddyFeatureDisabledError;
    await prisma.aiRequestLog.update({ where: { id: log.id }, data: { status: blocked ? "BLOCKED" : "FAILED", error: message, completedAt: new Date() } });
    await auditCollectionAction({ collectionId: request.collectionId, entityType: "AiRequestLog", entityId: log.id, action: error instanceof EddyRateLimitError ? "EDDY_RATE_LIMITED" : blocked ? "EDDY_BLOCKED" : "EDDY_FAILED", summary: `Eddy ${request.action.replaceAll("-", " ")} ${blocked ? "was blocked" : "failed"}`, actorUserId: request.userId, severity: "WARNING", details: { featureKey, provider: status.provider, error: message } });
    throw error;
  }
}
