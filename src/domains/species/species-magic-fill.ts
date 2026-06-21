import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { aiProviderStatus } from "@/domains/ai/ai-service";
import { auditCollectionAction } from "@/domains/audit/audit-service";
import { EddyFeatureDisabledError, EddyRateLimitError, incrementEddyUsage } from "@/domains/eddy/rate-limits";
import { normalizeSpeciesAlias, speciesAliasTypes } from "@/domains/species/aliases";

const nullableText = z.string().trim().max(2_000).nullable();
const nullableNumber = z.number().finite().nullable();
const categorySchema = z.enum(["FISH", "INVERT", "PLANT", "CORAL", "OTHER"]);
const aliasTypeSchema = z.enum(speciesAliasTypes as [typeof speciesAliasTypes[number], ...typeof speciesAliasTypes]);

export const speciesMagicFillInputSchema = z.object({
  category: categorySchema.default("OTHER"),
  commonName: z.string().trim().max(200).optional().default(""),
  genus: z.string().trim().max(120).optional().default(""),
  species: z.string().trim().max(120).optional().default(""),
  variety: z.string().trim().max(120).optional().default(""),
  cultivar: z.string().trim().max(120).optional().default(""),
  lifespan: z.string().trim().max(200).optional().default(""),
  minimumGroupSize: z.coerce.number().finite().nullable().optional(),
  maxHeight: z.coerce.number().finite().nullable().optional(),
  maxSpread: z.coerce.number().finite().nullable().optional(),
  growthRate: z.string().trim().max(200).optional().default(""),
  lightRequirement: z.string().trim().max(200).optional().default(""),
  co2Preference: z.string().trim().max(200).optional().default(""),
  preferredHardness: z.string().trim().max(300).optional().default(""),
  breedingNotes: z.string().trim().max(1_000).optional().default(""),
  flowRequirement: z.string().trim().max(300).optional().default(""),
  tempMin: z.coerce.number().finite().nullable().optional(), tempMax: z.coerce.number().finite().nullable().optional(),
  phMin: z.coerce.number().finite().nullable().optional(), phMax: z.coerce.number().finite().nullable().optional(),
  ghMin: z.coerce.number().finite().nullable().optional(), ghMax: z.coerce.number().finite().nullable().optional(),
  khMin: z.coerce.number().finite().nullable().optional(), khMax: z.coerce.number().finite().nullable().optional(),
  salinityMin: z.coerce.number().finite().nullable().optional(), salinityMax: z.coerce.number().finite().nullable().optional(),
  notes: z.string().trim().max(2_000).optional().default(""),
  existingAliases: z.array(z.object({ alias: z.string().trim().max(200), aliasType: aliasTypeSchema })).max(24).optional().default([])
});

const aliasSchema = z.object({ alias: z.string().trim().min(1).max(200), aliasType: aliasTypeSchema, notes: nullableText, source: z.string().trim().max(240).nullable() });
const profileSchema = z.object({
  lifespan: nullableText, minimumGroupSize: nullableNumber, tempMin: nullableNumber, tempMax: nullableNumber,
  phMin: nullableNumber, phMax: nullableNumber, ghMin: nullableNumber, ghMax: nullableNumber,
  khMin: nullableNumber, khMax: nullableNumber, salinityMin: nullableNumber, salinityMax: nullableNumber,
  maxHeight: nullableNumber, maxSpread: nullableNumber, growthRate: nullableText, lightRequirement: nullableText,
  co2Preference: nullableText, preferredHardness: nullableText, breedingNotes: nullableText, flowRequirement: nullableText, notes: nullableText
});

export const speciesMagicFillDraftSchema = z.object({
  confidence: z.enum(["LOW", "MEDIUM", "HIGH"]),
  summary: z.string().trim().min(1).max(1_000),
  warnings: z.array(z.string().trim().min(1).max(500)).max(12),
  canonical: z.object({ category: categorySchema, commonName: nullableText, genus: nullableText, species: nullableText, variety: nullableText, cultivar: nullableText, scientificDisplayName: nullableText }),
  aliases: z.array(aliasSchema).max(12),
  profile: profileSchema
});

export type SpeciesMagicFillInput = z.infer<typeof speciesMagicFillInputSchema>;
export type SpeciesMagicFillDraft = z.infer<typeof speciesMagicFillDraftSchema>;

const nullProfile: SpeciesMagicFillDraft["profile"] = {
  lifespan: null, minimumGroupSize: null, tempMin: null, tempMax: null, phMin: null, phMax: null,
  ghMin: null, ghMax: null, khMin: null, khMax: null, salinityMin: null, salinityMax: null,
  maxHeight: null, maxSpread: null, growthRate: null, lightRequirement: null, co2Preference: null,
  preferredHardness: null, breedingNotes: null, flowRequirement: null, notes: null
};

function titleCase(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : null;
}

export function mockSpeciesMagicFill(rawInput: unknown): SpeciesMagicFillDraft {
  const input = speciesMagicFillInputSchema.parse(rawInput);
  const genus = input.genus.toLowerCase();
  const species = input.species.toLowerCase();
  const commonName = input.commonName.toLowerCase();
  if (genus === "julidochromis" && (species === "transcriptus" || species === "marlieri" || commonName.includes("masked julie"))) {
    const mismatch = species === "marlieri" && commonName.includes("masked julie");
    return speciesMagicFillDraftSchema.parse({
      confidence: mismatch ? "MEDIUM" : "HIGH",
      summary: "Eddy recognized Masked Julie and prepared a Lake Tanganyika species draft. Review ranges against your preferred husbandry source before saving.",
      warnings: mismatch ? ["The entered epithet marlieri usually refers to a different Julidochromis species; this draft proposes transcriptus from the common name."] : [],
      canonical: { category: "FISH", commonName: "Masked Julie", genus: "Julidochromis", species: "transcriptus", variety: null, cultivar: null, scientificDisplayName: "Julidochromis transcriptus" },
      aliases: [{ alias: "Masked Julii", aliasType: "COMMON_NAME", notes: "Common spelling variant", source: "Eddy draft" }],
      profile: { ...nullProfile, lifespan: "5–8 years", minimumGroupSize: 1, tempMin: 74, tempMax: 80, phMin: 7.8, phMax: 9, ghMin: 8, ghMax: 20, khMin: 8, khMax: 18, salinityMin: 0, salinityMax: 0.5, preferredHardness: "Hard, alkaline water", breedingNotes: "Cave-spawning cichlid; established pairs may become territorial.", flowRequirement: "Moderate circulation", notes: "Provide rockwork with caves and visual barriers." }
    });
  }
  const scientific = [titleCase(input.genus), input.species.toLowerCase() || null].filter(Boolean).join(" ") || null;
  return speciesMagicFillDraftSchema.parse({
    confidence: "LOW",
    summary: "Eddy normalized the supplied names but could not safely infer missing husbandry facts with the local provider.",
    warnings: ["Verify taxonomy, aliases, and care values against a trusted species reference."],
    canonical: { category: input.category, commonName: input.commonName || null, genus: titleCase(input.genus), species: input.species.toLowerCase() || null, variety: input.variety || null, cultivar: input.cultivar || null, scientificDisplayName: scientific },
    aliases: [], profile: { ...nullProfile }
  });
}

function sanitizeDraft(value: unknown, existingAliases: SpeciesMagicFillInput["existingAliases"] = []): SpeciesMagicFillDraft {
  const draft = speciesMagicFillDraftSchema.parse(value);
  const seen = new Set(existingAliases.map((row) => normalizeSpeciesAlias(row.alias)));
  for (const canonical of [draft.canonical.commonName, draft.canonical.scientificDisplayName]) if (canonical) seen.add(normalizeSpeciesAlias(canonical));
  draft.aliases = draft.aliases.filter((row) => {
    const key = normalizeSpeciesAlias(row.alias);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);
  const warnings = [...draft.warnings];
  for (const [minKey, maxKey] of [["tempMin", "tempMax"], ["phMin", "phMax"], ["ghMin", "ghMax"], ["khMin", "khMax"], ["salinityMin", "salinityMax"]] as const) {
    const min = draft.profile[minKey]; const max = draft.profile[maxKey];
    if (typeof min === "number" && typeof max === "number" && min > max) {
      draft.profile[minKey] = max; draft.profile[maxKey] = min;
      warnings.push(`${minKey}/${maxKey} were reversed and have been reordered.`);
    }
  }
  draft.profile.salinityMin = draft.profile.salinityMin == null ? null : Math.max(0, draft.profile.salinityMin);
  draft.profile.salinityMax = draft.profile.salinityMax == null ? null : Math.max(0, draft.profile.salinityMax);
  draft.warnings = [...new Set(warnings)].slice(0, 12);
  return draft;
}

const jsonSchema = {
  type: "object", additionalProperties: false,
  required: ["confidence", "summary", "warnings", "canonical", "aliases", "profile"],
  properties: {
    confidence: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] }, summary: { type: "string" }, warnings: { type: "array", items: { type: "string" } },
    canonical: { type: "object", additionalProperties: false, required: ["category", "commonName", "genus", "species", "variety", "cultivar", "scientificDisplayName"], properties: { category: { type: "string", enum: ["FISH", "INVERT", "PLANT", "CORAL", "OTHER"] }, commonName: nullableString(), genus: nullableString(), species: nullableString(), variety: nullableString(), cultivar: nullableString(), scientificDisplayName: nullableString() } },
    aliases: { type: "array", items: { type: "object", additionalProperties: false, required: ["alias", "aliasType", "notes", "source"], properties: { alias: { type: "string" }, aliasType: { type: "string", enum: speciesAliasTypes }, notes: nullableString(), source: nullableString() } } },
    profile: { type: "object", additionalProperties: false, required: Object.keys(nullProfile), properties: Object.fromEntries(Object.keys(nullProfile).map((key) => [key, ["minimumGroupSize", "tempMin", "tempMax", "phMin", "phMax", "ghMin", "ghMax", "khMin", "khMax", "salinityMin", "salinityMax", "maxHeight", "maxSpread"].includes(key) ? { type: ["number", "null"] } : nullableString()])) }
  }
};
function nullableString() { return { type: ["string", "null"] }; }

async function runOpenAi(input: SpeciesMagicFillInput) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: process.env.OPENAI_DEFAULT_RESPONSES_MODEL || process.env.OPENAI_DEFAULT_CHAT_MODEL || "gpt-4.1-mini", store: false, max_output_tokens: 1_800,
      instructions: "You are Eddy, Fluxpoint's aquarium species assistant. Normalize the keeper's record and draft conservative values for review. Return null for unknown fields. Never fabricate precision, invent a cultivar or variety, or silently change an unusual supplied identity: explain likely corrections in warnings. Prefer conservative ranges, concise notes, and commonly supported aliases. Do not repeat existing aliases or replace the canonical name with an alias. Return only the requested schema.",
      input: JSON.stringify(input), text: { format: { type: "json_schema", name: "fluxpoint_species_magic_fill", strict: true, schema: jsonSchema } } })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || "Eddy's species provider request failed.");
  const content = payload.output?.flatMap((item: any) => item.content ?? []) ?? [];
  const refusal = content.find((item: any) => item.type === "refusal")?.refusal;
  if (refusal) throw new Error(`Eddy could not draft this species: ${refusal}`);
  const text = payload.output_text ?? content.find((item: any) => typeof item.text === "string")?.text;
  if (!text) throw new Error("Eddy returned an empty species draft.");
  return { draft: sanitizeDraft(JSON.parse(text), input.existingAliases), tokensInput: Number(payload?.usage?.input_tokens) || null, tokensOutput: Number(payload?.usage?.output_tokens) || null };
}

export async function runSpeciesMagicFill(request: { userId: string; collectionId: string; speciesDefinitionId?: string | null; input: unknown }) {
  const input = speciesMagicFillInputSchema.parse(request.input);
  if (request.speciesDefinitionId) await prisma.speciesDefinition.findFirstOrThrow({ where: { id: request.speciesDefinitionId, OR: [{ collectionId: request.collectionId }, { collectionId: null }] }, select: { id: true } });
  const status = aiProviderStatus();
  const log = await prisma.aiRequestLog.create({ data: { collectionId: request.collectionId, speciesDefinitionId: request.speciesDefinitionId || null, userId: request.userId, requestType: "HUSBANDRY", featureKey: "SPECIES_MAGIC_FILL", provider: status.provider, model: status.responsesModel, promptSummary: `Species Magic Fill: ${input.commonName || [input.genus, input.species].filter(Boolean).join(" ") || "new species"}`.slice(0, 240), input: input as never } });
  await auditCollectionAction({ collectionId: request.collectionId, entityType: "AiRequestLog", entityId: log.id, action: "EDDY_SPECIES_MAGIC_FILL_REQUESTED", summary: "Eddy Species Magic Fill requested", actorUserId: request.userId, metadata: { speciesDefinitionId: request.speciesDefinitionId, provider: status.provider } });
  try {
    const usage = await incrementEddyUsage({ userId: request.userId, collectionId: request.collectionId, featureKey: "SPECIES_MAGIC_FILL", requestLogId: log.id });
    await prisma.aiRequestLog.update({ where: { id: log.id }, data: { providerAttempted: true } });
    const result = status.enabled && status.provider === "openai" && process.env.OPENAI_API_KEY ? await runOpenAi(input) : { draft: sanitizeDraft(mockSpeciesMagicFill(input), input.existingAliases), tokensInput: null, tokensOutput: null };
    await prisma.aiRequestLog.update({ where: { id: log.id }, data: { status: "SUCCEEDED", output: result.draft as never, tokensInput: result.tokensInput, tokensOutput: result.tokensOutput, completedAt: new Date() } });
    await auditCollectionAction({ collectionId: request.collectionId, entityType: "AiRequestLog", entityId: log.id, action: "EDDY_SPECIES_MAGIC_FILL_SUCCEEDED", summary: "Eddy Species Magic Fill draft created", actorUserId: request.userId, metadata: { confidence: result.draft.confidence, provider: status.provider } });
    return { draft: result.draft, usage, requestLogId: log.id };
  } catch (error) {
    const blocked = error instanceof EddyRateLimitError || error instanceof EddyFeatureDisabledError;
    const message = error instanceof Error ? error.message : String(error);
    await prisma.aiRequestLog.update({ where: { id: log.id }, data: { status: blocked ? "BLOCKED" : "FAILED", error: message, completedAt: new Date() } });
    await auditCollectionAction({ collectionId: request.collectionId, entityType: "AiRequestLog", entityId: log.id, action: error instanceof EddyRateLimitError ? "EDDY_RATE_LIMITED" : blocked ? "EDDY_BLOCKED" : "EDDY_SPECIES_MAGIC_FILL_FAILED", summary: `Eddy Species Magic Fill ${blocked ? "was blocked" : "failed"}`, actorUserId: request.userId, severity: "WARNING", details: { error: message, provider: status.provider } });
    throw error;
  }
}
