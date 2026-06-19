import type { AiRequestType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { aiProviderStatus } from "@/domains/ai/ai-service";
import { buildEddyAquariumContext, buildEddyPageContext, buildEddySpeciesContext } from "@/domains/eddy/eddy-context";
import { buildEddyPrompt, EDDY_SYSTEM_PROMPT } from "@/domains/eddy/eddy-prompts";
import type { EddyAction, EddyResult } from "@/domains/eddy/eddy-types";

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
  troubleshooting: "TROUBLESHOOTING",
  "husbandry-fill": "HUSBANDRY",
  species: "HUSBANDRY"
};

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
  return cleanResult(JSON.parse(text.slice(start, end + 1)), fallback);
}

export async function runEddyRequest(request: EddyRequest) {
  const context = request.aquariumId
    ? await buildEddyAquariumContext(request.aquariumId, request.userId)
    : request.speciesDefinitionId
      ? await buildEddySpeciesContext(request.speciesDefinitionId, request.userId, String(request.input?.speciesType || "") || undefined)
      : await buildEddyPageContext(request.userId, request.page || "Fluxpoint");
  const prompt = buildEddyPrompt(request.action, context, request.input ?? {});
  const status = aiProviderStatus();
  const log = await prisma.aiRequestLog.create({ data: { collectionId: request.collectionId, aquariumId: request.aquariumId || null, speciesDefinitionId: request.speciesDefinitionId || null, userId: request.userId, requestType: requestTypes[request.action] ?? "OTHER", provider: status.provider, model: status.responsesModel, promptSummary: `${request.action}: ${request.input?.question || request.input?.proposal || request.input?.goal || request.page || "Fluxpoint context"}`.slice(0, 240), input: { action: request.action, input: request.input, page: request.page } as never } });
  try {
    const fallback = mockResult(request, context);
    const result = status.enabled && status.provider === "openai" && process.env.OPENAI_API_KEY ? await runOpenAi(prompt, fallback) : fallback;
    if (request.action === "husbandry-fill" && context.kind === "species") {
      result.fields = Object.fromEntries(context.requestedFields.map(({ key }) => [key, result.fields?.[key] ?? null]));
    }
    await prisma.aiRequestLog.update({ where: { id: log.id }, data: { status: "SUCCEEDED", output: result as never, completedAt: new Date() } });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.aiRequestLog.update({ where: { id: log.id }, data: { status: "FAILED", error: message, completedAt: new Date() } });
    throw error;
  }
}
