import type { AiRequestType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { aiProviderStatus } from "@/domains/ai/ai-service";
import { buildEddyAquariumContext, buildEddyPageContext, buildEddySpeciesContext } from "@/domains/eddy/eddy-context";
import { buildEddyPrompt, EDDY_SYSTEM_PROMPT } from "@/domains/eddy/eddy-prompts";
import type { EddyAction, EddyResult } from "@/domains/eddy/eddy-types";
import { featureForEddyAction } from "@/domains/eddy/eddy-features";
import { EddyFeatureDisabledError, EddyRateLimitError, incrementEddyUsage } from "@/domains/eddy/rate-limits";

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
    suggestions: Array.isArray(value.suggestions) ? value.suggestions.map((item) => ({ name: String(item?.name || "Suggestion"), detail: String(item?.detail || ""), ...(item?.caution ? { caution: String(item.caution) } : {}) })) : fallback.suggestions,
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
  if (request.action === "cover-concepts") return { ...base, title: "Cover concepts", suggestions: [{ name: "Quiet current", detail: "Palette: deep teal, clear cyan, warm sand. Motif: soft waterline, plant silhouettes, restrained bubbles." }, { name: "Field journal", detail: "Palette: ink green, moss, parchment. Motif: specimen notes and fine aquatic linework." }, { name: "Blue hour", detail: "Palette: midnight blue, electric cyan, pearl. Motif: low-light caustics and a single bright focal point." }] };
  if (request.action === "troubleshooting") return { ...base, title: "Troubleshooting questions", questions: ["What changed in the last 72 hours?", "Are temperature, ammonia, nitrite, nitrate, and pH freshly logged?", "Are affected animals eating, breathing normally, hiding, flashing, or isolating?", "Did equipment, food, livestock, plants, hardscape, or medication change recently?"], recommendations: ["Do not treat this as a diagnosis.", "For any medication, verify the product label and observe livestock carefully."] };
  if (request.action === "husbandry-fill" && context.kind === "species") return { ...base, title: "Eddy husbandry draft", fields: Object.fromEntries(context.requestedFields.map((field: any) => [field.key, field.key === "careDifficulty" ? "Moderate; review for the exact species." : null])), recommendations: ["Review every field before saving; null means Eddy did not have enough reliable context."] };
  if (request.action === "care-recommendations") return { ...base, title: `Care plan for ${String(request.input?.timeframe || "this week")}`, recommendations: overdue ? ["Review overdue tasks first and record completion or a deliberate skip.", "Check recent parameters and observe livestock before changing routine."] : base.recommendations };
  if (request.action === "care-digest") return { ...base, title: `Care digest for ${String(request.input?.timeframe || "today")}`, summary: `${context.openTasks.length} open care task(s) and ${context.recentEvents.length} recent event(s) are available in the collection record.`, recommendations: context.openTasks.length ? ["Review the earliest due tasks first.", "Record completion or a deliberate skip so the care queue stays trustworthy."] : ["No open care tasks are recorded. Review schedules if you expected work to be due."] };
  if (request.action === "species-care-summary") return { ...base, title: `${name} care summary`, summary: "Eddy reviewed the species definition and current husbandry guide without filling missing facts.", recommendations: ["Review missing fields against a trusted species reference before marking the guide reviewed."] };
  return base;
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
    return { ...result, usage };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const blocked = error instanceof EddyRateLimitError || error instanceof EddyFeatureDisabledError;
    await prisma.aiRequestLog.update({ where: { id: log.id }, data: { status: blocked ? "BLOCKED" : "FAILED", error: message, completedAt: new Date() } });
    throw error;
  }
}
