import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { aiProviderStatus } from "@/domains/ai/ai-service";
import { auditCollectionAction } from "@/domains/audit/audit-service";
import { incrementEddyUsage, EddyFeatureDisabledError, EddyRateLimitError } from "@/domains/eddy/rate-limits";
import { getEffectiveHusbandryForItem } from "@/domains/husbandry/husbandry-service";
import { habitatsForSalinity } from "@/domains/species/habitat";
import { canViewCollection } from "@/domains/auth/permissions";

export const advisorParameterKeys = ["temperature", "ph", "gh", "kh", "salinity", "tds", "nitrate", "ammonia", "nitrite"] as const;
export type AdvisorParameterKey = typeof advisorParameterKeys[number];
export type NumericRange = { min: number | null; max: number | null; target?: number | null; unit: string };
export type AdvisorStockedSpecies = {
  itemId: string;
  name: string;
  category: string;
  quantity: number;
  ranges: Partial<Record<AdvisorParameterKey, NumericRange>>;
  husbandrySummary: string | null;
};

export type ParameterOverlap = {
  parameter: AdvisorParameterKey;
  unit: string;
  knownRanges: Array<{ species: string; min: number; max: number }>;
  missingSpecies: string[];
  intersectionMin: number | null;
  intersectionMax: number | null;
  unionMin: number | null;
  unionMax: number | null;
  hasConflict: boolean;
  currentTargetStatus: "ALIGNED" | "PARTIAL" | "OUTSIDE" | "CONFLICT" | "INSUFFICIENT_DATA";
};

const parameterSchema = z.enum(advisorParameterKeys);
const nullableFinite = z.number().finite().nullable();
export const parameterAdvisorRecommendationSchema = z.object({
  parameter: parameterSchema,
  currentTarget: z.string().trim().max(120).nullable(),
  currentRange: z.string().trim().max(120).nullable(),
  suggestedTarget: z.string().trim().max(120).nullable(),
  suggestedRange: z.string().trim().max(120).nullable(),
  suggestedTargetValue: nullableFinite,
  suggestedMin: nullableFinite,
  suggestedMax: nullableFinite,
  status: z.enum(["KEEP", "ADJUST", "CONFLICT", "INSUFFICIENT_DATA"]),
  safeToApply: z.boolean(),
  reason: z.string().trim().min(1).max(800),
  affectedSpecies: z.array(z.string().trim().min(1).max(200)).max(30),
  cautions: z.array(z.string().trim().min(1).max(500)).max(8)
});

export const parameterAdvisorDraftSchema = z.object({
  confidence: z.enum(["LOW", "MEDIUM", "HIGH"]),
  summary: z.string().trim().min(1).max(1_200),
  overallFit: z.enum(["GOOD", "WATCH", "CONFLICT", "INSUFFICIENT_DATA"]),
  recommendations: z.array(parameterAdvisorRecommendationSchema).min(1).max(advisorParameterKeys.length),
  stockingConflicts: z.array(z.object({ species: z.string().trim().min(1).max(300), issue: z.string().trim().min(1).max(800), severity: z.enum(["LOW", "MODERATE", "HIGH"]), parameter: parameterSchema })).max(30),
  missingData: z.array(z.string().trim().min(1).max(500)).max(60),
  safeAdjustmentNotes: z.array(z.string().trim().min(1).max(500)).min(1).max(12)
});

export type ParameterAdvisorDraft = z.infer<typeof parameterAdvisorDraftSchema>;

const parameterUnits: Record<AdvisorParameterKey, string> = { temperature: "°F", ph: "", gh: "dGH", kh: "dKH", salinity: "ppt", tds: "ppm", nitrate: "ppm", ammonia: "ppm", nitrite: "ppm" };

export function normalizeParameterUnits(parameter: AdvisorParameterKey, value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return null;
  const precision = parameter === "ph" || parameter === "salinity" ? 2 : 1;
  return Number(value.toFixed(precision));
}

export function parseRangeText(value: unknown, unit: string): NumericRange | null {
  if (typeof value !== "string") return null;
  const numbers = value.match(/\d+(?:\.\d+)?/g)?.map(Number).filter(Number.isFinite) ?? [];
  if (!numbers.length) return null;
  return { min: numbers[0], max: numbers[1] ?? numbers[0], unit };
}

function completeRange(range?: NumericRange | null) {
  return range && range.min != null && range.max != null && Number.isFinite(range.min) && Number.isFinite(range.max)
    ? { min: Math.min(range.min, range.max), max: Math.max(range.min, range.max) }
    : null;
}

export function calculateParameterOverlap(stockedSpecies: AdvisorStockedSpecies[], parameter: AdvisorParameterKey, current?: NumericRange | null): ParameterOverlap {
  const knownRanges: ParameterOverlap["knownRanges"] = [];
  const missingSpecies: string[] = [];
  for (const species of stockedSpecies) {
    const range = completeRange(species.ranges[parameter]);
    if (!range) missingSpecies.push(species.name);
    else knownRanges.push({ species: species.name, ...range });
  }
  const intersectionMin = knownRanges.length ? Math.max(...knownRanges.map((range) => range.min)) : null;
  const intersectionMax = knownRanges.length ? Math.min(...knownRanges.map((range) => range.max)) : null;
  const unionMin = knownRanges.length ? Math.min(...knownRanges.map((range) => range.min)) : null;
  const unionMax = knownRanges.length ? Math.max(...knownRanges.map((range) => range.max)) : null;
  const hasConflict = intersectionMin != null && intersectionMax != null && intersectionMin > intersectionMax;
  const currentRange = completeRange(current);
  let currentTargetStatus: ParameterOverlap["currentTargetStatus"] = "INSUFFICIENT_DATA";
  if (hasConflict) currentTargetStatus = "CONFLICT";
  else if (intersectionMin != null && intersectionMax != null && currentRange) {
    if (currentRange.min >= intersectionMin && currentRange.max <= intersectionMax) currentTargetStatus = "ALIGNED";
    else if (currentRange.max >= intersectionMin && currentRange.min <= intersectionMax) currentTargetStatus = "PARTIAL";
    else currentTargetStatus = "OUTSIDE";
  }
  return { parameter, unit: parameterUnits[parameter], knownRanges, missingSpecies: [...new Set(missingSpecies)], intersectionMin, intersectionMax, unionMin, unionMax, hasConflict, currentTargetStatus };
}

export function calculateAllParameterOverlaps(stockedSpecies: AdvisorStockedSpecies[], currentTargets: Record<AdvisorParameterKey, NumericRange>) {
  return Object.fromEntries(advisorParameterKeys.map((parameter) => [parameter, calculateParameterOverlap(stockedSpecies, parameter, currentTargets[parameter])])) as Record<AdvisorParameterKey, ParameterOverlap>;
}

function profileRange(target: number | null | undefined, min: number | null | undefined, max: number | null | undefined, spread: number, unit: string): NumericRange {
  return { target: target ?? null, min: min ?? (target == null ? null : Math.max(0, target - spread)), max: max ?? (target == null ? null : target + spread), unit };
}

export function formatCurrentTankTargets(aquarium: any): Record<AdvisorParameterKey, NumericRange> {
  const profile = aquarium.profile;
  const metric = (key: string) => aquarium.metricConfigs?.find((row: any) => row.metricDefinition?.key === key);
  return {
    temperature: profileRange(profile?.targetTemperature, profile?.targetTemperatureMin, profile?.targetTemperatureMax, 2, "°F"),
    ph: profileRange(profile?.targetPh, profile?.targetPhMin, profile?.targetPhMax, 0.3, ""),
    gh: profileRange(profile?.targetGh, profile?.targetGhMin, profile?.targetGhMax, 2, "dGH"),
    kh: profileRange(profile?.targetKh, profile?.targetKhMin, profile?.targetKhMax, 2, "dKH"),
    salinity: { min: aquarium.targetSalinityMinPpt ?? null, max: aquarium.targetSalinityMaxPpt ?? null, target: aquarium.targetSalinityMinPpt != null && aquarium.targetSalinityMaxPpt != null ? (aquarium.targetSalinityMinPpt + aquarium.targetSalinityMaxPpt) / 2 : null, unit: "ppt" },
    tds: { min: metric("tds_ppm")?.minValue ?? null, max: metric("tds_ppm")?.maxValue ?? null, target: null, unit: "ppm" },
    nitrate: { min: profile?.targetNitrateMin ?? 0, max: profile?.targetNitrateMax ?? 40, target: null, unit: "ppm" },
    ammonia: { min: profile?.targetAmmoniaMin ?? 0, max: profile?.targetAmmoniaMax ?? 0, target: 0, unit: "ppm" },
    nitrite: { min: profile?.targetNitriteMin ?? 0, max: profile?.targetNitriteMax ?? 0, target: 0, unit: "ppm" }
  };
}

export type AquariumParameterAdvisorContext = {
  aquarium: Record<string, unknown>;
  currentTargets: Record<AdvisorParameterKey, NumericRange>;
  stocking: AdvisorStockedSpecies[];
  overlaps: Record<AdvisorParameterKey, ParameterOverlap>;
  activeConditions: Array<Record<string, unknown>>;
  activeMedications: Array<Record<string, unknown>>;
  recentLosses: Array<Record<string, unknown>>;
  latestReadings: Array<Record<string, unknown>>;
  recentTimeline: Array<Record<string, unknown>>;
};

export async function buildAquariumParameterAdvisorContext(aquariumId: string, userId: string, collectionId: string): Promise<AquariumParameterAdvisorContext> {
  if (!(await canViewCollection(userId, collectionId))) throw new Error("You do not have access to this aquarium.");
  const aquarium = await prisma.aquarium.findFirstOrThrow({
    where: { id: aquariumId, collectionId },
    include: {
      profile: true,
      structuredLocation: { select: { name: true } },
      items: { where: { status: { in: ["ACTIVE", "IN_AQUARIUM"] }, itemType: { in: ["FISH", "INVERT", "PLANT", "BOTANICAL", "OTHER"] } }, include: { speciesDefinition: true } },
      metricConfigs: { include: { metricDefinition: true, latestValue: true } },
      healthConditions: { where: { status: { in: ["WATCHING", "ACTIVE", "TREATING", "IMPROVING", "WORSENING"] } }, orderBy: { lastObservedAt: "desc" }, take: 8 },
      medicationCourses: { where: { status: "ACTIVE" }, include: { medicationDefinition: true }, orderBy: { startedAt: "desc" }, take: 6 },
      readings: { orderBy: { measuredAt: "desc" }, take: 80 },
      events: { orderBy: { eventDate: "desc" }, take: 24 }
    }
  });
  const stocking = await Promise.all(aquarium.items.map(async (item): Promise<AdvisorStockedSpecies> => {
    const species = item.speciesDefinition;
    const husbandry = species ? await getEffectiveHusbandryForItem(item.id) : null;
    const tds = parseRangeText((husbandry?.fields as any)?.tdsRange, "ppm");
    return {
      itemId: item.id,
      name: species?.commonName || item.name,
      category: species?.category ?? item.itemType,
      quantity: item.quantity,
      ranges: species ? {
        temperature: { min: species.tempMin, max: species.tempMax, unit: "°F" },
        ph: { min: species.phMin, max: species.phMax, unit: "" },
        gh: { min: species.ghMin, max: species.ghMax, unit: "dGH" },
        kh: { min: species.khMin, max: species.khMax, unit: "dKH" },
        salinity: { min: species.salinityMin, max: species.salinityMax, unit: "ppt" },
        ...(tds ? { tds } : {})
      } : {},
      husbandrySummary: species ? [husbandry?.guide?.summary, species.careNotes, species.notes, (husbandry?.fields as any)?.water].filter(Boolean).join(" ").slice(0, 500) || null : "No linked species definition."
    };
  }));
  const currentTargets = formatCurrentTankTargets(aquarium);
  const overlaps = calculateAllParameterOverlaps(stocking, currentTargets);
  const latest = new Map<string, any>();
  for (const config of aquarium.metricConfigs) if (config.latestValue && !latest.has(config.metricDefinition.key)) latest.set(config.metricDefinition.key, { parameter: config.metricDefinition.displayName, value: config.latestValue.value, unit: config.latestValue.unit, measuredAt: config.latestValue.measuredAt });
  for (const reading of aquarium.readings) if (!latest.has(reading.parameter)) latest.set(reading.parameter, { parameter: reading.parameter, value: reading.value, unit: reading.unit, measuredAt: reading.measuredAt });
  return {
    aquarium: { id: aquarium.id, name: aquarium.generatedName ?? aquarium.name, volume: aquarium.volumeGallons, volumeUnit: aquarium.volumeUnit, tankType: aquarium.aquariumType, habitats: habitatsForSalinity(aquarium.targetSalinityMinPpt, aquarium.targetSalinityMaxPpt), location: aquarium.structuredLocation?.name ?? aquarium.location, notes: aquarium.notes },
    currentTargets,
    stocking,
    overlaps,
    activeConditions: aquarium.healthConditions.map((row) => ({ title: row.title, severity: row.severity, status: row.status, summary: row.summary })),
    activeMedications: aquarium.medicationCourses.map((row) => ({ title: row.title, medication: row.medicationDefinition.name, reason: row.reason, status: row.status })),
    recentLosses: aquarium.events.filter((row) => ["LIVESTOCK_LOSS", "DEATH"].includes(row.eventType)).slice(0, 6).map((row) => ({ title: row.title, summary: row.summary, date: row.eventDate })),
    latestReadings: [...latest.values()].slice(0, 16),
    recentTimeline: aquarium.events.slice(0, 10).map((row) => ({ type: row.eventType, title: row.title, summary: row.summary, date: row.eventDate }))
  };
}

function formatted(value: number | null, unit: string) {
  return value == null ? null : `${Number(value.toFixed(2))}${unit ? ` ${unit}` : ""}`;
}

function formattedRange(range: Pick<NumericRange, "min" | "max" | "unit">) {
  if (range.min == null && range.max == null) return null;
  if (range.min === range.max) return formatted(range.min, range.unit);
  return `${range.min == null ? "?" : Number(range.min.toFixed(2))}–${range.max == null ? "?" : Number(range.max.toFixed(2))}${range.unit ? ` ${range.unit}` : ""}`;
}

export function mockAquariumParameterAdvisor(context: AquariumParameterAdvisorContext): ParameterAdvisorDraft {
  const recommendations = advisorParameterKeys.map((parameter): z.infer<typeof parameterAdvisorRecommendationSchema> => {
    const current = context.currentTargets[parameter];
    const overlap = context.overlaps[parameter];
    const affectedSpecies = overlap.knownRanges.map((row) => row.species);
    const gradual = ["ph", "gh", "kh", "salinity"].includes(parameter) ? ["Prioritize stability and make any water-chemistry change gradually while observing inhabitants."] : [];
    if (parameter === "ammonia" || parameter === "nitrite") {
      const aligned = current.min === 0 && current.max === 0;
      return { parameter, currentTarget: formatted(current.target ?? null, current.unit), currentRange: formattedRange(current), suggestedTarget: "0 ppm", suggestedRange: "0 ppm", suggestedTargetValue: 0, suggestedMin: 0, suggestedMax: 0, status: aligned ? "KEEP" : "ADJUST", safeToApply: !aligned, reason: `${parameter === "ammonia" ? "Ammonia" : "Nitrite"} should remain at zero; it is not a parameter to optimize upward.`, affectedSpecies: context.stocking.map((row) => row.name), cautions: [] };
    }
    if (parameter === "nitrate") {
      const suggestedMax = current.max == null || current.max > 40 ? 40 : current.max;
      const adjust = current.min !== 0 || current.max == null || current.max > 40;
      return { parameter, currentTarget: null, currentRange: formattedRange(current), suggestedTarget: null, suggestedRange: `0–${suggestedMax} ppm`, suggestedTargetValue: null, suggestedMin: 0, suggestedMax, status: adjust ? "ADJUST" : "KEEP", safeToApply: adjust, reason: "Treat nitrate as an upper safety threshold rather than a target; stocking-specific sensitivity is not structured in the saved profiles.", affectedSpecies: context.stocking.map((row) => row.name), cautions: ["Use husbandry observations and the tank's plant and stocking load when choosing a stricter threshold."] };
    }
    if (!overlap.knownRanges.length) return { parameter, currentTarget: formatted(current.target ?? null, current.unit), currentRange: formattedRange(current), suggestedTarget: null, suggestedRange: null, suggestedTargetValue: null, suggestedMin: null, suggestedMax: null, status: "INSUFFICIENT_DATA", safeToApply: false, reason: "No complete saved species range is available for a defensible stocking-based recommendation.", affectedSpecies: [], cautions: gradual };
    if (overlap.hasConflict) return { parameter, currentTarget: formatted(current.target ?? null, current.unit), currentRange: formattedRange(current), suggestedTarget: null, suggestedRange: null, suggestedTargetValue: null, suggestedMin: null, suggestedMax: null, status: "CONFLICT", safeToApply: false, reason: "The saved species ranges do not share an overlap, so Eddy will not force a false compromise.", affectedSpecies, cautions: [...gradual, "Review stocking compatibility before changing the tank to favor one species."] };
    const min = normalizeParameterUnits(parameter, overlap.intersectionMin);
    const max = normalizeParameterUnits(parameter, overlap.intersectionMax);
    const target = min != null && max != null ? normalizeParameterUnits(parameter, (min + max) / 2) : null;
    const aligned = overlap.currentTargetStatus === "ALIGNED";
    return { parameter, currentTarget: formatted(current.target ?? null, current.unit), currentRange: formattedRange(current), suggestedTarget: formatted(target, current.unit), suggestedRange: formattedRange({ min, max, unit: current.unit }), suggestedTargetValue: target, suggestedMin: min, suggestedMax: max, status: aligned ? "KEEP" : "ADJUST", safeToApply: !aligned && min != null && max != null, reason: aligned ? "The current saved range sits inside the shared range of species with known data." : "This range follows the shared overlap of the saved stocking profiles.", affectedSpecies, cautions: gradual };
  });
  const conflicts = recommendations.filter((row) => row.status === "CONFLICT");
  const speciesRangeParameters: AdvisorParameterKey[] = ["temperature", "ph", "gh", "kh", "salinity", "tds"];
  const missingData = speciesRangeParameters.flatMap((parameter) => context.overlaps[parameter].missingSpecies.map((species) => `${species} has no complete saved ${parameter} range.`));
  const overallFit = !context.stocking.length ? "INSUFFICIENT_DATA" : conflicts.length ? "CONFLICT" : recommendations.some((row) => row.status === "ADJUST") ? "WATCH" : missingData.length ? "WATCH" : "GOOD";
  const knownCount = context.stocking.length * 5 - ["temperature", "ph", "gh", "kh", "salinity"].reduce((total, key) => total + context.overlaps[key as AdvisorParameterKey].missingSpecies.length, 0);
  return parameterAdvisorDraftSchema.parse({
    confidence: !context.stocking.length || knownCount <= 0 ? "LOW" : missingData.length || conflicts.length ? "MEDIUM" : "HIGH",
    summary: !context.stocking.length ? "No active stocked species with linked definitions are available for a stocking-based review." : conflicts.length ? `The saved stocking has ${conflicts.length} parameter conflict${conflicts.length === 1 ? "" : "s"}; review those before changing targets.` : recommendations.some((row) => row.status === "ADJUST") ? "Most stocking ranges can be reconciled, but one or more saved targets should be reviewed." : "The current saved targets fit the available stocking ranges.",
    overallFit,
    recommendations,
    stockingConflicts: conflicts.flatMap((row) => row.affectedSpecies.map((species) => ({ species, issue: `No shared ${row.parameter} overlap exists across the stocked species with known data.`, severity: "HIGH", parameter: row.parameter }))).slice(0, 30),
    missingData: [...new Set(missingData)].slice(0, 60),
    safeAdjustmentNotes: ["Eddy's parameter advice is decision support, not a guarantee; verify sensitive changes against trusted husbandry sources.", "Adjust pH, GH, KH, and salinity gradually. Stable water is safer than chasing exact numbers.", "Ammonia and nitrite should remain at 0 ppm."]
  });
}

function sanitizeDraft(value: unknown, fallback: ParameterAdvisorDraft): ParameterAdvisorDraft {
  const draft = parameterAdvisorDraftSchema.parse(value);
  const byParameter = new Map(draft.recommendations.map((row) => [row.parameter, row]));
  draft.recommendations = advisorParameterKeys.map((parameter) => byParameter.get(parameter) ?? fallback.recommendations.find((row) => row.parameter === parameter)!).map((row) => {
    const deterministic = fallback.recommendations.find((entry) => entry.parameter === row.parameter)!;
    if (row.parameter === "ammonia" || row.parameter === "nitrite") return { ...row, suggestedTarget: "0 ppm", suggestedRange: "0 ppm", suggestedTargetValue: 0, suggestedMin: 0, suggestedMax: 0, safeToApply: row.status === "ADJUST" };
    const ordered = row.suggestedMin != null && row.suggestedMax != null && row.suggestedMin > row.suggestedMax ? { suggestedMin: row.suggestedMax, suggestedMax: row.suggestedMin } : { suggestedMin: row.suggestedMin, suggestedMax: row.suggestedMax };
    const insideDeterministicRange = deterministic.suggestedMin != null && deterministic.suggestedMax != null && ordered.suggestedMin != null && ordered.suggestedMax != null && ordered.suggestedMin >= deterministic.suggestedMin && ordered.suggestedMax <= deterministic.suggestedMax;
    return { ...row, ...ordered, safeToApply: row.status === "ADJUST" && !["CONFLICT", "INSUFFICIENT_DATA"].includes(deterministic.status) && insideDeterministicRange };
  });
  draft.safeAdjustmentNotes = [...new Set([...draft.safeAdjustmentNotes, "Adjust pH, GH, KH, and salinity gradually; prioritize stability over chasing exact numbers.", "Ammonia and nitrite should remain at 0 ppm."])].slice(0, 12);
  return parameterAdvisorDraftSchema.parse(draft);
}

const jsonSchema = {
  type: "object", additionalProperties: false,
  required: ["confidence", "summary", "overallFit", "recommendations", "stockingConflicts", "missingData", "safeAdjustmentNotes"],
  properties: {
    confidence: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] }, summary: { type: "string" }, overallFit: { type: "string", enum: ["GOOD", "WATCH", "CONFLICT", "INSUFFICIENT_DATA"] },
    recommendations: { type: "array", items: { type: "object", additionalProperties: false, required: ["parameter", "currentTarget", "currentRange", "suggestedTarget", "suggestedRange", "suggestedTargetValue", "suggestedMin", "suggestedMax", "status", "safeToApply", "reason", "affectedSpecies", "cautions"], properties: { parameter: { type: "string", enum: advisorParameterKeys }, currentTarget: nullableString(), currentRange: nullableString(), suggestedTarget: nullableString(), suggestedRange: nullableString(), suggestedTargetValue: nullableNumber(), suggestedMin: nullableNumber(), suggestedMax: nullableNumber(), status: { type: "string", enum: ["KEEP", "ADJUST", "CONFLICT", "INSUFFICIENT_DATA"] }, safeToApply: { type: "boolean" }, reason: { type: "string" }, affectedSpecies: { type: "array", items: { type: "string" } }, cautions: { type: "array", items: { type: "string" } } } } },
    stockingConflicts: { type: "array", items: { type: "object", additionalProperties: false, required: ["species", "issue", "severity", "parameter"], properties: { species: { type: "string" }, issue: { type: "string" }, severity: { type: "string", enum: ["LOW", "MODERATE", "HIGH"] }, parameter: { type: "string", enum: advisorParameterKeys } } } },
    missingData: { type: "array", items: { type: "string" } }, safeAdjustmentNotes: { type: "array", items: { type: "string" } }
  }
} as const;
function nullableString() { return { type: ["string", "null"] }; }
function nullableNumber() { return { type: ["number", "null"] }; }

async function runOpenAi(context: AquariumParameterAdvisorContext, fallback: ParameterAdvisorDraft) {
  const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: JSON.stringify({ model: process.env.OPENAI_DEFAULT_RESPONSES_MODEL || process.env.OPENAI_DEFAULT_CHAT_MODEL || "gpt-4.1-mini", store: false, max_output_tokens: 3_200, instructions: "You are Eddy, Fluxpoint's aquarium parameter advisor. Use only the supplied saved records and deterministic overlap analysis. Return JSON only in the requested schema. Prefer stable, moderate targets inside a real shared overlap. Call out conflicts instead of forcing a compromise. Never invent precision from missing data. Never recommend nonzero ammonia or nitrite. Treat nitrate as a safety threshold, not a desired concentration. Recommend gradual pH, GH, KH, salinity, and temperature changes. Preserve current targets when they already fit. A recommendation is safeToApply only when status is ADJUST, a real non-conflicting numeric range exists, and the change follows the deterministic overlap. Keep explanations concise and practical.", input: JSON.stringify(context), text: { format: { type: "json_schema", name: "fluxpoint_aquarium_parameter_advisor", strict: true, schema: jsonSchema } } }) });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || "Eddy's parameter advisor request failed.");
  const content = payload.output?.flatMap((item: any) => item.content ?? []) ?? [];
  const refusal = content.find((item: any) => item.type === "refusal")?.refusal;
  if (refusal) throw new Error(`Eddy could not review these parameters: ${refusal}`);
  const text = payload.output_text ?? content.find((item: any) => typeof item.text === "string")?.text;
  if (!text) throw new Error("Eddy returned an empty parameter review.");
  return { draft: sanitizeDraft(JSON.parse(text), fallback), tokensInput: Number(payload.usage?.input_tokens) || null, tokensOutput: Number(payload.usage?.output_tokens) || null };
}

export async function runAquariumParameterAdvisor(input: { aquariumId: string; userId: string; collectionId: string }) {
  const context = await buildAquariumParameterAdvisorContext(input.aquariumId, input.userId, input.collectionId);
  const fallback = mockAquariumParameterAdvisor(context);
  const status = aiProviderStatus();
  const log = await prisma.aiRequestLog.create({ data: { collectionId: input.collectionId, aquariumId: input.aquariumId, userId: input.userId, requestType: "CARE_ADVICE", featureKey: "AQUARIUM_PARAMETER_ADVISOR", provider: status.provider, model: status.responsesModel, promptSummary: `Parameter Advisor: ${String(context.aquarium.name)}`.slice(0, 240), input: { aquarium: context.aquarium, currentTargets: context.currentTargets, stocking: context.stocking, overlaps: context.overlaps, activeConditions: context.activeConditions, activeMedications: context.activeMedications, recentLosses: context.recentLosses, latestReadings: context.latestReadings, recentTimeline: context.recentTimeline } as never } });
  await auditCollectionAction({ collectionId: input.collectionId, entityType: "AiRequestLog", entityId: log.id, action: "EDDY_PARAMETER_ADVISOR_REQUESTED", summary: `Eddy parameter review requested for ${String(context.aquarium.name)}`, actorUserId: input.userId, metadata: { aquariumId: input.aquariumId, featureKey: "AQUARIUM_PARAMETER_ADVISOR", stockedSpecies: context.stocking.length } });
  try {
    const usage = await incrementEddyUsage({ userId: input.userId, collectionId: input.collectionId, featureKey: "AQUARIUM_PARAMETER_ADVISOR", requestLogId: log.id });
    await prisma.aiRequestLog.update({ where: { id: log.id }, data: { providerAttempted: true } });
    const result = status.enabled && status.provider === "openai" && process.env.OPENAI_API_KEY ? await runOpenAi(context, fallback) : { draft: fallback, tokensInput: null, tokensOutput: null };
    await prisma.aiRequestLog.update({ where: { id: log.id }, data: { status: "SUCCEEDED", output: result.draft as never, tokensInput: result.tokensInput, tokensOutput: result.tokensOutput, completedAt: new Date() } });
    await auditCollectionAction({ collectionId: input.collectionId, entityType: "AiRequestLog", entityId: log.id, action: "EDDY_PARAMETER_ADVISOR_SUCCEEDED", summary: `Eddy parameter review completed for ${String(context.aquarium.name)}`, actorUserId: input.userId, metadata: { aquariumId: input.aquariumId, overallFit: result.draft.overallFit, confidence: result.draft.confidence } });
    return { draft: result.draft, analysis: context.overlaps, requestLogId: log.id, usage };
  } catch (error) {
    const blocked = error instanceof EddyRateLimitError || error instanceof EddyFeatureDisabledError;
    const message = error instanceof Error ? error.message : String(error);
    await prisma.aiRequestLog.update({ where: { id: log.id }, data: { status: blocked ? "BLOCKED" : "FAILED", error: message, completedAt: new Date() } });
    await auditCollectionAction({ collectionId: input.collectionId, entityType: "AiRequestLog", entityId: log.id, action: error instanceof EddyRateLimitError ? "EDDY_RATE_LIMITED" : blocked ? "EDDY_BLOCKED" : "EDDY_PARAMETER_ADVISOR_FAILED", summary: `Eddy parameter review ${blocked ? "was blocked" : "failed"}`, actorUserId: input.userId, severity: "WARNING", details: { aquariumId: input.aquariumId, error: message } });
    throw error;
  }
}
