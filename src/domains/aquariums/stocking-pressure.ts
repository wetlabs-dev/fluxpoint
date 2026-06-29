import { createHash } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { aiProviderStatus } from "@/domains/ai/ai-service";
import { auditCollectionAction } from "@/domains/audit/audit-service";
import { canViewCollection } from "@/domains/auth/permissions";
import { EddyFeatureDisabledError, EddyRateLimitError, incrementEddyUsage } from "@/domains/eddy/rate-limits";
import { stockingPressureFlagSchema, type StockingPressureFlag } from "@/domains/aquariums/stocking-pressure-flags";

export const stockingPressureLevels = ["UNKNOWN", "VERY_LIGHT", "LIGHT", "MODERATE", "HEAVY", "OVERSTOCKED"] as const;
export const stockingPressureConfidences = ["LOW", "MEDIUM", "HIGH"] as const;
const REQUIRED_CAUTION = "This estimate is based on saved stocking, filtration, and plant records. It is not a substitute for water testing or observation.";

export const stockingPressureEstimateSchema = z.object({
  level: z.enum(stockingPressureLevels),
  confidence: z.enum(stockingPressureConfidences),
  flags: z.array(stockingPressureFlagSchema).max(4),
  summary: z.string().trim().min(1).max(800),
  reasoning: z.array(z.string().trim().min(1).max(500)).min(1).max(6),
  cautions: z.array(z.string().trim().min(1).max(500)).min(1).max(5),
  missingData: z.array(z.string().trim().min(1).max(300)).max(8)
});

export type StockingPressureDraft = z.infer<typeof stockingPressureEstimateSchema>;

export type StockingPressureContext = {
  aquarium: {
    id: string;
    name: string;
    volume: number | null;
    volumeUnit: "GALLON" | "LITER";
    volumeGallons: number | null;
    dimensionsInches: Array<number | null>;
    aquariumType: string;
    targetSalinityPpt: [number | null, number | null];
    status: string;
  };
  stocking: Array<{
    itemId: string;
    itemType: string;
    name: string;
    quantity: number;
    status: string;
    notes: string | null;
    species: null | {
      id: string;
      category: string;
      commonName: string;
      scientificName: string | null;
      maxSize: string | null;
      maxHeight: number | null;
      notes: string | null;
      careNotes: string | null;
      husbandryFields: unknown;
    };
  }>;
  filtration: Array<{
    attachmentId: string;
    itemId: string;
    name: string;
    role: string;
    equipmentType: string | null;
    brand: string | null;
    model: string | null;
    notes: string | null;
    attachmentNotes: string | null;
  }>;
  legacyFiltration: string | null;
  latestNitrogenReadings: Array<{ parameter: string; value: number; unit: string; measuredAt: string }>;
};

export class StockingPressureCurrentError extends Error {
  status = 409;
  constructor() { super("Refresh is available after stocking, filtration, or volume changes."); }
}

const activeStatuses = ["ACTIVE", "IN_AQUARIUM"] as const;

export async function buildStockingPressureContext(aquariumId: string, userId: string, collectionId: string): Promise<StockingPressureContext> {
  if (!(await canViewCollection(userId, collectionId))) throw new Error("You do not have access to this aquarium.");
  const aquarium = await prisma.aquarium.findFirstOrThrow({
    where: { id: aquariumId, collectionId },
    include: {
      profile: { select: { filtration: true } },
      items: {
        where: { itemType: { in: ["FISH", "INVERT", "PLANT", "BOTANICAL", "OTHER"] } },
        include: { speciesDefinition: { include: { husbandryGuide: { select: { fields: true } } } } }
      },
      equipmentAttachments: {
        include: { item: { include: { equipmentProfile: true } } },
        orderBy: [{ role: "asc" }, { sortOrder: "asc" }, { itemId: "asc" }]
      },
      readings: { where: { parameter: { in: ["AMMONIA", "NITRITE", "NITRATE"] } }, orderBy: { measuredAt: "desc" }, take: 30 }
    }
  });
  const stockedItems = aquarium.items.filter((item) => isStockingItemIncluded(item, aquarium.aquariumType));
  const latest = new Map<string, typeof aquarium.readings[number]>();
  for (const reading of aquarium.readings) if (!latest.has(reading.parameter)) latest.set(reading.parameter, reading);
  const volumeGallons = aquarium.volumeGallons == null ? null : aquarium.volumeUnit === "LITER" ? aquarium.volumeGallons / 3.785411784 : aquarium.volumeGallons;
  return {
    aquarium: {
      id: aquarium.id,
      name: aquarium.generatedName ?? aquarium.name,
      volume: aquarium.volumeGallons,
      volumeUnit: aquarium.volumeUnit,
      volumeGallons,
      dimensionsInches: [aquarium.lengthInches, aquarium.widthInches, aquarium.heightInches],
      aquariumType: aquarium.aquariumType,
      targetSalinityPpt: [aquarium.targetSalinityMinPpt, aquarium.targetSalinityMaxPpt],
      status: aquarium.status
    },
    stocking: stockedItems.sort((a, b) => a.id.localeCompare(b.id)).map((item) => ({
      itemId: item.id,
      itemType: item.itemType,
      name: item.name,
      quantity: item.quantity,
      status: item.status,
      notes: item.notes,
      species: item.speciesDefinition ? {
        id: item.speciesDefinition.id,
        category: item.speciesDefinition.category,
        commonName: item.speciesDefinition.commonName,
        scientificName: item.speciesDefinition.scientificName,
        maxSize: item.speciesDefinition.maxSize,
        maxHeight: item.speciesDefinition.maxHeight,
        notes: item.speciesDefinition.notes,
        careNotes: item.speciesDefinition.careNotes,
        husbandryFields: item.speciesDefinition.husbandryGuide?.fields ?? null
      } : null
    })),
    filtration: aquarium.equipmentAttachments
      .filter((attachment) => attachment.role === "FILTER" || attachment.item.equipmentProfile?.equipmentType === "FILTER")
      .map((attachment) => ({ attachmentId: attachment.id, itemId: attachment.item.id, name: attachment.item.name, role: attachment.role, equipmentType: attachment.item.equipmentProfile?.equipmentType ?? null, brand: attachment.item.equipmentProfile?.brand ?? null, model: attachment.item.equipmentProfile?.model ?? null, notes: attachment.item.equipmentProfile?.notes ?? attachment.item.notes, attachmentNotes: attachment.notes })),
    legacyFiltration: aquarium.profile?.filtration ?? null,
    latestNitrogenReadings: [...latest.values()].map((reading) => ({ parameter: reading.parameter, value: reading.value, unit: reading.unit, measuredAt: reading.measuredAt.toISOString() }))
  };
}

export function isStockingItemIncluded(item: { status: string; storageLocationId?: string | null; quarantineProjectId?: string | null }, aquariumType: string) {
  const allowedStatuses: string[] = aquariumType === "QUARANTINE" ? [...activeStatuses, "IN_QUARANTINE"] : [...activeStatuses];
  return allowedStatuses.includes(item.status) && item.storageLocationId == null && (aquariumType === "QUARANTINE" || item.quarantineProjectId == null);
}

export function buildAquariumStockingPressureFingerprint(context: StockingPressureContext) {
  const relevant = {
    aquarium: {
      volume: context.aquarium.volume,
      volumeUnit: context.aquarium.volumeUnit,
      volumeGallons: context.aquarium.volumeGallons,
      dimensionsInches: context.aquarium.dimensionsInches,
      aquariumType: context.aquarium.aquariumType,
      targetSalinityPpt: context.aquarium.targetSalinityPpt
    },
    stocking: context.stocking,
    filtration: context.filtration,
    legacyFiltration: context.legacyFiltration
  };
  return createHash("sha256").update(JSON.stringify(relevant)).digest("hex");
}

export function summarizeStocking(context: StockingPressureContext) {
  const groups = context.stocking.map((item) => ({ type: item.itemType, name: item.species?.commonName ?? item.name, scientificName: item.species?.scientificName ?? null, quantity: item.quantity, identified: Boolean(item.species), notes: item.notes ?? item.species?.careNotes ?? item.species?.notes ?? null }));
  return { groups, fishCount: quantityFor(context, "FISH"), invertCount: quantityFor(context, "INVERT"), distinctAnimalGroups: context.stocking.filter((item) => ["FISH", "INVERT"].includes(item.itemType)).length };
}

export function summarizeFiltration(context: StockingPressureContext) {
  return { filterCount: context.filtration.length, filters: context.filtration.map((filter) => ({ name: filter.name, type: filter.equipmentType, brand: filter.brand, model: filter.model, notes: filter.attachmentNotes ?? filter.notes })), legacyDescription: context.legacyFiltration };
}

export function summarizePlants(context: StockingPressureContext) {
  const plants = context.stocking.filter((item) => item.itemType === "PLANT");
  return { plantCount: plants.reduce((sum, item) => sum + item.quantity, 0), plantGroups: plants.map((item) => ({ name: item.species?.commonName ?? item.name, quantity: item.quantity })), biomassKnown: false };
}

export function derivePreliminaryStockingPressureFlags(context: StockingPressureContext): StockingPressureFlag[] {
  const flags: StockingPressureFlag[] = [];
  const text = context.stocking.map(stockText).join(" ").toLowerCase();
  const plants = summarizePlants(context);
  const fishCount = quantityFor(context, "FISH");
  const shrimpCount = context.stocking.filter((item) => item.itemType === "INVERT" && /shrimp|neocaridina|caridina/.test(stockText(item))).reduce((sum, item) => sum + item.quantity, 0);
  const unidentifiedAnimals = context.stocking.filter((item) => ["FISH", "INVERT"].includes(item.itemType) && !item.species).length;
  if (plants.plantCount > 0) flags.push("PLANT_ASSISTED");
  if (plants.plantCount >= 10 || plants.plantGroups.length >= 5) flags.push("HIGH_PLANT_MASS");
  if (!context.filtration.length && fishCount > 0) flags.push("UNDER_FILTERED");
  if (context.filtration.length > 1) flags.push("MULTI_FILTER_SUPPORT");
  if (context.aquarium.volumeGallons == null || unidentifiedAnimals || (!context.filtration.length && !context.legacyFiltration)) flags.push("SPARSE_DATA");
  if (context.stocking.some((item) => item.itemType === "FISH") && context.stocking.filter((item) => item.itemType === "FISH").some((item) => !adultSizeKnown(item))) flags.push("ADULT_SIZE_UNCERTAIN");
  if (/juvenile|young|grow[- ]?out|fry/.test(text)) flags.push("JUVENILE_STOCK");
  if (/(guppy|endler|platy|molly|swordtail)/.test(text) && fishCount >= 8) flags.push("HEAVY_LIVEBEARER_LOAD");
  if (/(oscar|goldfish|koi|common pleco|sailfin pleco|pacu)/.test(text)) flags.push("LARGE_BODIED_FISH");
  if (fishCount >= 20) flags.push("HIGH_SCHOOLING_COUNT");
  if (shrimpCount > 0 && shrimpCount >= Math.max(4, fishCount * 2)) flags.push("SHRIMP_DOMINANT");
  if (/(goldfish|oscar|pleco|pacu|large cichlid)/.test(text)) flags.push("HIGH_WASTE_SPECIES");
  if (context.filtration.some((filter) => /low flow|reduced flow/.test(`${filter.notes ?? ""} ${filter.attachmentNotes ?? ""}`.toLowerCase()))) flags.push("LOW_FLOW_CONTEXT");
  if (context.stocking.filter((item) => ["FISH", "INVERT", "BOTANICAL", "OTHER"].includes(item.itemType)).length >= 7) flags.push("STOCK_MIX_COMPLEX");
  if (flags.includes("JUVENILE_STOCK") && (flags.includes("LARGE_BODIED_FISH") || fishCount >= 12)) flags.push("OVERSTOCK_RISK_IF_MATURE");
  return [...new Set(flags)];
}

export function buildStockingPressureInputSummary(context: StockingPressureContext) {
  return { aquarium: context.aquarium, stocking: summarizeStocking(context), filtration: summarizeFiltration(context), plants: summarizePlants(context), latestNitrogenReadings: context.latestNitrogenReadings, candidateFlags: derivePreliminaryStockingPressureFlags(context) };
}

export function mockAquariumStockingPressure(context: StockingPressureContext): StockingPressureDraft {
  const flags = derivePreliminaryStockingPressureFlags(context);
  const animals = context.stocking.filter((item) => ["FISH", "INVERT", "BOTANICAL", "OTHER"].includes(item.itemType));
  const plants = summarizePlants(context);
  const fishCount = quantityFor(context, "FISH");
  const missingData: string[] = [];
  if (context.aquarium.volumeGallons == null) missingData.push("Aquarium volume is not recorded.");
  if (!context.filtration.length && !context.legacyFiltration) missingData.push("No filtration details are recorded.");
  if (animals.some((item) => !item.species)) missingData.push("One or more animal records has no linked species definition.");
  if (flags.includes("ADULT_SIZE_UNCERTAIN")) missingData.push("Adult size is unclear for one or more fish groups.");

  let level: StockingPressureDraft["level"] = "UNKNOWN";
  const volume = context.aquarium.volumeGallons;
  if (!animals.length && volume != null) level = "VERY_LIGHT";
  else if (volume != null) {
    let load = context.stocking.reduce((sum, item) => sum + item.quantity * impactFactor(item), 0);
    load *= Math.max(0.8, 1 - Math.min(0.2, plants.plantCount * 0.01));
    const filterSupport = context.filtration.length > 1 ? 1.25 : context.filtration.length === 1 || context.legacyFiltration ? 1 : 0.65;
    const relative = load / Math.max(1, (volume / 2.5) * filterSupport);
    level = relative < 0.25 ? "VERY_LIGHT" : relative < 0.55 ? "LIGHT" : relative < 0.9 ? "MODERATE" : relative < 1.25 ? "HEAVY" : "OVERSTOCKED";
    if (!context.filtration.length && !context.legacyFiltration && fishCount > 0) level = fishCount >= 12 ? "OVERSTOCKED" : levelRank(level) < levelRank("HEAVY") ? "HEAVY" : level;
  }
  const completeness = Number(volume != null) + Number(animals.every((item) => Boolean(item.species))) + Number(Boolean(context.filtration.length || context.legacyFiltration)) + Number(context.filtration.some((filter) => Boolean(filter.brand || filter.model || filter.notes || filter.attachmentNotes)));
  const confidence: StockingPressureDraft["confidence"] = completeness >= 4 ? "HIGH" : completeness >= 2 ? "MEDIUM" : "LOW";
  const summary = level === "UNKNOWN" ? "There is not enough saved information to estimate stocking pressure yet." : level === "VERY_LIGHT" ? "This aquarium appears very lightly stocked for its saved volume and filtration context." : level === "LIGHT" ? "This aquarium appears lightly stocked for its saved volume and filtration context." : level === "MODERATE" ? "This aquarium appears moderately stocked for its current volume and filtration." : level === "HEAVY" ? "This aquarium appears heavily stocked for its current volume and filtration." : "This aquarium appears overstocked for its current saved volume and filtration context.";
  const reasoning: string[] = [];
  if (!animals.length) reasoning.push("No active animal inhabitants are assigned to this aquarium.");
  if (flags.includes("SHRIMP_DOMINANT")) reasoning.push("Shrimp are extremely low impact individually, even when kept in a group.");
  if (flags.includes("HEAVY_LIVEBEARER_LOAD")) reasoning.push("Livebearers are low to moderate impact individually, but this recorded group is large and can grow quickly.");
  if (flags.includes("HIGH_WASTE_SPECIES")) reasoning.push("One or more recorded fish groups is commonly higher-waste and adds disproportionate pressure.");
  if (plants.plantCount > 0) reasoning.push("Plants help absorb nitrate, but they do not replace filtration, water changes, or observation.");
  if (context.filtration.length > 1) reasoning.push("Multiple attached filters improve processing capacity and resilience.");
  else if (!context.filtration.length && !context.legacyFiltration && fishCount > 0) reasoning.push("No filtration record is available, so the estimate is conservative.");
  if (!reasoning.length) reasoning.push("The estimate compares saved animal groups with the aquarium volume and filtration records.");
  return stockingPressureEstimateSchema.parse({ level, confidence, flags: prioritizeFlags(flags).slice(0, 4), summary, reasoning: reasoning.slice(0, 6), cautions: [REQUIRED_CAUTION], missingData: missingData.slice(0, 8) });
}

const jsonSchema = {
  type: "object", additionalProperties: false,
  properties: {
    level: { type: "string", enum: stockingPressureLevels },
    confidence: { type: "string", enum: stockingPressureConfidences },
    flags: { type: "array", maxItems: 4, items: { type: "string", enum: stockingPressureFlagSchema.options } },
    summary: { type: "string" },
    reasoning: { type: "array", minItems: 1, maxItems: 6, items: { type: "string" } },
    cautions: { type: "array", minItems: 1, maxItems: 5, items: { type: "string" } },
    missingData: { type: "array", maxItems: 8, items: { type: "string" } }
  },
  required: ["level", "confidence", "flags", "summary", "reasoning", "cautions", "missingData"]
};

function sanitizeDraft(value: unknown) {
  const draft = stockingPressureEstimateSchema.parse(value);
  const cautions = draft.cautions.includes(REQUIRED_CAUTION) ? draft.cautions : [REQUIRED_CAUTION, ...draft.cautions].slice(0, 5);
  return { ...draft, flags: [...new Set(draft.flags)].slice(0, 4), cautions };
}

async function runOpenAi(summary: ReturnType<typeof buildStockingPressureInputSummary>) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: process.env.OPENAI_DEFAULT_RESPONSES_MODEL || process.env.OPENAI_DEFAULT_CHAT_MODEL || "gpt-4.1-mini",
      store: false,
      max_output_tokens: 1_400,
      instructions: `You are Eddy, Fluxpoint's aquarium stocking-pressure estimator. Use only the saved context. Return a qualitative level and confidence, never a percentage, score, exact capacity, or inch-per-gallon rule. Consider volume, identified animals, quantities, adult size uncertainty, attached filtration, and plants. Plants provide modest nutrient support but never cancel serious overstocking. Shrimp and small snails are very low impact. Messy or large-bodied species count more. Include zero to four allowed flags that explain the estimate or missing evidence. Keep reasoning concise. Avoid guarantees. Always include this exact caution: "${REQUIRED_CAUTION}"`,
      input: JSON.stringify(summary),
      text: { format: { type: "json_schema", name: "fluxpoint_aquarium_stocking_pressure", strict: true, schema: jsonSchema } }
    })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || "Eddy's stocking pressure request failed.");
  const content = payload.output?.flatMap((item: any) => item.content ?? []) ?? [];
  const refusal = content.find((item: any) => item.type === "refusal")?.refusal;
  if (refusal) throw new Error(`Eddy could not estimate stocking pressure: ${refusal}`);
  const text = payload.output_text ?? content.find((item: any) => typeof item.text === "string")?.text;
  if (!text) throw new Error("Eddy returned an empty stocking pressure estimate.");
  return { draft: sanitizeDraft(JSON.parse(text)), tokensInput: Number(payload?.usage?.input_tokens) || null, tokensOutput: Number(payload?.usage?.output_tokens) || null };
}

export async function getLatestStockingPressureState(aquariumId: string, userId: string, collectionId: string) {
  const [context, latest] = await Promise.all([
    buildStockingPressureContext(aquariumId, userId, collectionId),
    prisma.aquariumStockingPressureEstimate.findFirst({ where: { aquariumId, collectionId }, orderBy: { createdAt: "desc" } })
  ]);
  const fingerprint = buildAquariumStockingPressureFingerprint(context);
  return { context, latest, fingerprint, eligible: !latest || latest.inputFingerprint !== fingerprint, stale: Boolean(latest && latest.inputFingerprint !== fingerprint) };
}

export async function runAquariumStockingPressure(input: { aquariumId: string; userId: string; collectionId: string }) {
  const state = await getLatestStockingPressureState(input.aquariumId, input.userId, input.collectionId);
  if (!state.eligible) throw new StockingPressureCurrentError();
  const inputSummary = buildStockingPressureInputSummary(state.context);
  const fallback = mockAquariumStockingPressure(state.context);
  const status = aiProviderStatus();
  const usingOpenAi = status.enabled && status.provider === "openai" && Boolean(process.env.OPENAI_API_KEY);
  const log = await prisma.aiRequestLog.create({ data: { collectionId: input.collectionId, aquariumId: input.aquariumId, userId: input.userId, requestType: "STOCKING", featureKey: "AQUARIUM_STOCKING_PRESSURE", provider: usingOpenAi ? "openai" : "mock", model: usingOpenAi ? status.responsesModel : null, promptSummary: `Stocking Pressure: ${state.context.aquarium.name}`.slice(0, 240), input: inputSummary as never } });
  await auditCollectionAction({ collectionId: input.collectionId, entityType: "AiRequestLog", entityId: log.id, action: "EDDY_STOCKING_PRESSURE_REQUESTED", summary: `Stocking pressure estimate requested for ${state.context.aquarium.name}`, actorUserId: input.userId, metadata: { aquariumId: input.aquariumId, featureKey: "AQUARIUM_STOCKING_PRESSURE", provider: usingOpenAi ? "openai" : "mock" } });
  try {
    await incrementEddyUsage({ userId: input.userId, collectionId: input.collectionId, featureKey: "AQUARIUM_STOCKING_PRESSURE", requestLogId: log.id });
    if (usingOpenAi) await prisma.aiRequestLog.update({ where: { id: log.id }, data: { providerAttempted: true } });
    const result = usingOpenAi ? await runOpenAi(inputSummary) : { draft: fallback, tokensInput: null, tokensOutput: null };
    const estimate = await prisma.$transaction(async (tx) => {
      const created = await tx.aquariumStockingPressureEstimate.create({ data: { collectionId: input.collectionId, aquariumId: input.aquariumId, estimatedByUserId: input.userId, level: result.draft.level, confidence: result.draft.confidence, flags: result.draft.flags, summary: result.draft.summary, reasoning: result.draft.reasoning, cautions: result.draft.cautions, missingData: result.draft.missingData, inputFingerprint: state.fingerprint, inputSummary: inputSummary as never } });
      await tx.aiRequestLog.update({ where: { id: log.id }, data: { status: "SUCCEEDED", output: result.draft as never, tokensInput: result.tokensInput, tokensOutput: result.tokensOutput, completedAt: new Date() } });
      return created;
    });
    await auditCollectionAction({ collectionId: input.collectionId, entityType: "AquariumStockingPressureEstimate", entityId: estimate.id, action: "EDDY_STOCKING_PRESSURE_SAVED", summary: `Stocking pressure estimate saved for ${state.context.aquarium.name}`, actorUserId: input.userId, metadata: { aquariumId: input.aquariumId, level: estimate.level, confidence: estimate.confidence, provider: usingOpenAi ? "openai" : "mock" } });
    return { estimate: publicEstimate(estimate) };
  } catch (error) {
    const blocked = error instanceof EddyRateLimitError || error instanceof EddyFeatureDisabledError;
    const message = error instanceof Error ? error.message : String(error);
    await prisma.aiRequestLog.update({ where: { id: log.id }, data: { status: blocked ? "BLOCKED" : "FAILED", error: message, completedAt: new Date() } });
    await auditCollectionAction({ collectionId: input.collectionId, entityType: "AiRequestLog", entityId: log.id, action: error instanceof EddyRateLimitError ? "EDDY_STOCKING_PRESSURE_RATE_LIMITED" : "EDDY_STOCKING_PRESSURE_FAILED", summary: `Stocking pressure estimate ${blocked ? "was blocked" : "failed"}`, actorUserId: input.userId, severity: "WARNING", details: { aquariumId: input.aquariumId, provider: usingOpenAi ? "openai" : "mock", error: message } });
    throw error;
  }
}

export function publicEstimate(estimate: { id: string; level: StockingPressureDraft["level"]; confidence: StockingPressureDraft["confidence"]; flags: unknown; summary: string; reasoning: unknown; cautions: unknown; missingData: unknown; createdAt: Date }) {
  return { id: estimate.id, level: estimate.level, confidence: estimate.confidence, flags: z.array(stockingPressureFlagSchema).max(4).catch([]).parse(estimate.flags), summary: estimate.summary, reasoning: z.array(z.string()).catch([]).parse(estimate.reasoning), cautions: z.array(z.string()).catch([]).parse(estimate.cautions), missingData: z.array(z.string()).catch([]).parse(estimate.missingData), estimatedAt: estimate.createdAt.toISOString() };
}

function quantityFor(context: StockingPressureContext, itemType: string) { return context.stocking.filter((item) => item.itemType === itemType).reduce((sum, item) => sum + item.quantity, 0); }
function stockText(item: StockingPressureContext["stocking"][number]) { return [item.name, item.notes, item.species?.commonName, item.species?.scientificName, item.species?.maxSize ? `max size ${item.species.maxSize}` : null, item.species?.notes, item.species?.careNotes, JSON.stringify(item.species?.husbandryFields ?? null)].filter(Boolean).join(" "); }
function adultSizeKnown(item: StockingPressureContext["stocking"][number]) { return /adult|max(?:imum)? size|\b\d+(?:\.\d+)?\s*(?:in|inch|inches|cm)\b/i.test(stockText(item)); }
function impactFactor(item: StockingPressureContext["stocking"][number]) {
  const text = stockText(item).toLowerCase();
  if (item.itemType === "PLANT") return 0;
  if (item.itemType === "INVERT") return /shrimp|neocaridina|caridina|snail/.test(text) ? 0.08 : 0.3;
  if (item.itemType !== "FISH") return 0.25;
  if (/oscar|goldfish|koi|common pleco|sailfin pleco|pacu/.test(text)) return 3;
  if (/platy|molly|swordtail|pleco|large cichlid/.test(text)) return 1.8;
  return 1;
}
function levelRank(level: StockingPressureDraft["level"]) { return stockingPressureLevels.indexOf(level); }
function prioritizeFlags(flags: StockingPressureFlag[]) {
  const order: StockingPressureFlag[] = ["UNDER_FILTERED", "OVERSTOCK_RISK_IF_MATURE", "HEAVY_LIVEBEARER_LOAD", "HIGH_WASTE_SPECIES", "LARGE_BODIED_FISH", "SPARSE_DATA", "ADULT_SIZE_UNCERTAIN", "SHRIMP_DOMINANT", "MULTI_FILTER_SUPPORT", "HIGH_PLANT_MASS", "PLANT_ASSISTED", "HIGH_SCHOOLING_COUNT", "JUVENILE_STOCK", "LOW_FLOW_CONTEXT", "STOCK_MIX_COMPLEX"];
  return [...flags].sort((a, b) => order.indexOf(a) - order.indexOf(b));
}
