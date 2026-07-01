import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { aiProviderStatus } from "@/domains/ai/ai-service";
import { auditCollectionAction } from "@/domains/audit/audit-service";
import { EddyFeatureDisabledError, EddyRateLimitError, incrementEddyUsage } from "@/domains/eddy/rate-limits";
import { normalizeSpeciesAlias, speciesAliasTypes } from "@/domains/species/aliases";
import { buildLocalityLabel, hasRegionalLookupLocality, regionalSpeciesStatuses } from "@/domains/species/regional-status";
import { co2Requirements, normalizeCo2Requirement } from "@/domains/species/co2";
import { resolveSpeciesReferences } from "@/domains/species/species-reference-resolver";
import { normalizeAuthorCitation } from "@/lib/format/species";

const nullableText = z.string().trim().max(2_000).nullable();
const nullableNumber = z.number().finite().nullable();
const categorySchema = z.enum(["FISH", "INVERT", "PLANT", "CORAL", "OTHER"]);
const aliasTypeSchema = z.enum(speciesAliasTypes as [typeof speciesAliasTypes[number], ...typeof speciesAliasTypes]);
const co2RequirementSchema = z.enum(["UNKNOWN", "NOT_NEEDED", "RECOMMENDED", "REQUIRED"]);

export const speciesMagicFillInputSchema = z.object({
  category: categorySchema.default("OTHER"),
  commonName: z.string().trim().max(200).optional().default(""),
  genus: z.string().trim().max(120).optional().default(""),
  species: z.string().trim().max(120).optional().default(""),
  variety: z.string().trim().max(120).optional().default(""),
  cultivar: z.string().trim().max(120).optional().default(""),
  authorCitation: z.string().trim().max(240).optional().default(""),
  wikipediaUrl: z.string().trim().max(1_000).optional().default(""),
  inaturalistUrl: z.string().trim().max(1_000).optional().default(""),
  powoUrl: z.string().trim().max(1_000).optional().default(""),
  gbifUrl: z.string().trim().max(1_000).optional().default(""),
  lifespan: z.string().trim().max(200).optional().default(""),
  minimumGroupSize: z.coerce.number().finite().nullable().optional(),
  maxSize: z.string().trim().max(200).optional().default(""),
  maxHeight: z.coerce.number().finite().nullable().optional(),
  maxSpread: z.coerce.number().finite().nullable().optional(),
  growthRate: z.string().trim().max(200).optional().default(""),
  lightRequirement: z.string().trim().max(200).optional().default(""),
  co2Preference: z.string().trim().max(200).optional().default(""),
  co2Requirement: co2RequirementSchema.optional().default("UNKNOWN"),
  preferredHardness: z.string().trim().max(300).optional().default(""),
  breedingNotes: z.string().trim().max(1_000).optional().default(""),
  flowRequirement: z.string().trim().max(300).optional().default(""),
  tempMin: z.coerce.number().finite().nullable().optional(), tempMax: z.coerce.number().finite().nullable().optional(),
  phMin: z.coerce.number().finite().nullable().optional(), phMax: z.coerce.number().finite().nullable().optional(),
  ghMin: z.coerce.number().finite().nullable().optional(), ghMax: z.coerce.number().finite().nullable().optional(),
  khMin: z.coerce.number().finite().nullable().optional(), khMax: z.coerce.number().finite().nullable().optional(),
  salinityMinPpt: z.coerce.number().finite().nullable().optional(), salinityMaxPpt: z.coerce.number().finite().nullable().optional(),
  notes: z.string().trim().max(2_000).optional().default(""),
  existingAliases: z.array(z.object({ alias: z.string().trim().max(200), aliasType: aliasTypeSchema })).max(24).optional().default([]),
  collectionLocality: z.object({ localityCity: nullableText, localityRegion: nullableText, localityCountry: nullableText, localityPostalCode: nullableText, localityLabel: nullableText, regionalLookupEnabled: z.boolean() }).optional()
});

const aliasSchema = z.object({ alias: z.string().trim().min(1).max(200), aliasType: aliasTypeSchema, notes: nullableText, source: nullableText });
const profileSchema = z.object({
  lifespan: nullableText, minimumGroupSize: nullableNumber, tempMin: nullableNumber, tempMax: nullableNumber,
  phMin: nullableNumber, phMax: nullableNumber, ghMin: nullableNumber, ghMax: nullableNumber,
  khMin: nullableNumber, khMax: nullableNumber,
  maxSize: nullableText,
  maxHeight: nullableNumber, maxSpread: nullableNumber, growthRate: nullableText, lightRequirement: nullableText,
  co2Preference: nullableText, co2Requirement: co2RequirementSchema, preferredHardness: nullableText, breedingNotes: nullableText, flowRequirement: nullableText, notes: nullableText
});

export const speciesMagicFillDraftSchema = z.object({
  confidence: z.enum(["LOW", "MEDIUM", "HIGH"]),
  summary: z.string().trim().min(1).max(1_000),
  warnings: z.array(z.string().trim().min(1).max(500)).max(12),
  canonical: z.object({ category: categorySchema, commonName: nullableText, genus: nullableText, species: nullableText, variety: nullableText, cultivar: nullableText, scientificDisplayName: nullableText }),
  references: z.object({ authorCitation: nullableText, wikipediaUrl: z.string().url().nullable(), inaturalistUrl: z.string().url().nullable(), powoUrl: z.string().url().nullable(), gbifUrl: z.string().url().nullable() }),
  salinityMinPpt: nullableNumber,
  salinityMaxPpt: nullableNumber,
  aliases: z.array(aliasSchema).max(12),
  profile: profileSchema,
  regionalStatus: z.object({ status: z.enum(regionalSpeciesStatuses as [typeof regionalSpeciesStatuses[number], ...typeof regionalSpeciesStatuses]), localityLabel: nullableText, statusScope: nullableText, sourceName: nullableText, sourceUrl: z.string().url().nullable(), notes: nullableText, confidence: z.enum(["LOW", "MEDIUM", "HIGH"]).nullable() })
});

export type SpeciesMagicFillInput = z.infer<typeof speciesMagicFillInputSchema>;
export type SpeciesMagicFillDraft = z.infer<typeof speciesMagicFillDraftSchema>;

const nullProfile: SpeciesMagicFillDraft["profile"] = {
  lifespan: null, minimumGroupSize: null, tempMin: null, tempMax: null, phMin: null, phMax: null,
  ghMin: null, ghMax: null, khMin: null, khMax: null,
  maxSize: null,
  maxHeight: null, maxSpread: null, growthRate: null, lightRequirement: null, co2Preference: null, co2Requirement: "UNKNOWN",
  preferredHardness: null, breedingNotes: null, flowRequirement: null, notes: null
};

function mockRegionalStatus(input: SpeciesMagicFillInput): SpeciesMagicFillDraft["regionalStatus"] {
  const locality = input.collectionLocality;
  if (!locality?.regionalLookupEnabled) return { status: "UNKNOWN", localityLabel: locality?.localityLabel ?? null, statusScope: null, sourceName: null, sourceUrl: null, notes: "Add collection locality to check regional invasive/restricted status.", confidence: null };
  if (input.commonName.toLowerCase().includes("water hyacinth")) return { status: "WATCHLIST", localityLabel: locality.localityLabel, statusScope: locality.localityRegion ? "region" : "country", sourceName: "Mock regional fixture — verify with the relevant environmental authority", sourceUrl: null, notes: "This development draft flags a potentially concerning aquatic plant. Verify current local rules; this is not legal advice.", confidence: "LOW" };
  return { status: "UNKNOWN", localityLabel: locality.localityLabel, statusScope: locality.localityRegion ? "region" : "country", sourceName: null, sourceUrl: null, notes: "The local provider cannot verify a regional listing. Check the relevant wildlife, agriculture, or environmental authority.", confidence: "LOW" };
}

function titleCase(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : null;
}

export function mockSpeciesMagicFill(rawInput: unknown): SpeciesMagicFillDraft {
  const input = speciesMagicFillInputSchema.parse(rawInput);
  const genus = input.genus.toLowerCase();
  const species = input.species.toLowerCase();
  const commonName = input.commonName.toLowerCase();
  if (commonName.includes("java fern") || (["microsorum", "leptochilus"].includes(genus) && species === "pteropus")) {
    const categoryMismatch = input.category !== "PLANT";
    return speciesMagicFillDraftSchema.parse({
      confidence: "MEDIUM",
      summary: "Eddy recognized Java fern and drafted its taxonomy, reference metadata, aliases, salinity, and conservative aquarium plant profile for review.",
      warnings: categoryMismatch ? [`Java fern is a plant, but the selected category is ${input.category.toLowerCase()}; this draft proposes plant and will only change the form after review.`] : [],
      canonical: { category: "PLANT", commonName: "Java Fern", genus: "Microsorum", species: "pteropus", variety: null, cultivar: null, scientificDisplayName: "Microsorum pteropus" },
      references: { authorCitation: "(Blume) Copel.", wikipediaUrl: null, inaturalistUrl: null, powoUrl: null, gbifUrl: "https://www.gbif.org/species/7289955" },
      salinityMinPpt: 0,
      salinityMaxPpt: 0.5,
      aliases: [{ alias: "Leptochilus pteropus", aliasType: "SCIENTIFIC_SYNONYM", notes: "Accepted placement in some current taxonomic backbones", source: "GBIF Backbone Taxonomy" }],
      profile: { ...nullProfile, tempMin: 68, tempMax: 82, phMin: 6, phMax: 7.5, ghMin: 3, ghMax: 12, khMin: 2, khMax: 8, maxHeight: 12, maxSpread: 12, growthRate: "Slow", lightRequirement: "Low to medium", co2Preference: "Not required", co2Requirement: "NOT_NEEDED", flowRequirement: "Low to moderate", notes: "Attach the rhizome to wood or stone; do not bury it." },
      regionalStatus: mockRegionalStatus(input)
    });
  }
  if (commonName.includes("zebra obliquidens") || (genus === "astatotilapia" && species === "latifasciata") || (genus === "haplochromis" && species === "latifasciatus")) {
    return speciesMagicFillDraftSchema.parse({
      confidence: "HIGH",
      summary: "Eddy recognized zebra obliquidens and drafted a complete taxonomy, reference, alias, salinity, and aquarium care profile for review.",
      warnings: ["Taxonomic backbones differ on whether this fish is placed in Astatotilapia or Haplochromis; this draft preserves the widely used aquarium name and records the alternate placement as an alias."],
      canonical: { category: "FISH", commonName: "Zebra Obliquidens", genus: "Astatotilapia", species: "latifasciata", variety: null, cultivar: null, scientificDisplayName: "Astatotilapia latifasciata" },
      references: { authorCitation: "Regan, 1929", wikipediaUrl: null, inaturalistUrl: null, powoUrl: null, gbifUrl: "https://www.gbif.org/species/2373362" },
      salinityMinPpt: 0,
      salinityMaxPpt: 0.5,
      aliases: [{ alias: "Haplochromis latifasciatus", aliasType: "SCIENTIFIC_SYNONYM", notes: "Alternate accepted placement used by GBIF Backbone Taxonomy", source: "GBIF Backbone Taxonomy" }],
      profile: { ...nullProfile, lifespan: "5–8 years", minimumGroupSize: 1, maxSize: "4–5 in", tempMin: 72, tempMax: 82, phMin: 7, phMax: 8.5, ghMin: 8, ghMax: 20, khMin: 5, khMax: 15, preferredHardness: "Moderately hard to very hard", breedingNotes: "Maternal mouthbrooder; provide visual barriers and avoid crowding incompatible males.", flowRequirement: "Moderate", notes: "Lake Victoria-region cichlid; keep with similarly robust tankmates and provide rockwork and territories." },
      regionalStatus: mockRegionalStatus(input)
    });
  }
  if (genus === "julidochromis" && (species === "transcriptus" || species === "marlieri" || commonName.includes("masked julie"))) {
    const mismatch = species === "marlieri" && commonName.includes("masked julie");
    return speciesMagicFillDraftSchema.parse({
      confidence: mismatch ? "MEDIUM" : "HIGH",
      summary: "Eddy recognized Masked Julie and prepared a Lake Tanganyika species draft. Review ranges against your preferred husbandry source before saving.",
      warnings: mismatch ? ["The entered epithet marlieri usually refers to a different Julidochromis species; this draft proposes transcriptus from the common name."] : [],
      canonical: { category: "FISH", commonName: "Masked Julie", genus: "Julidochromis", species: "transcriptus", variety: null, cultivar: null, scientificDisplayName: "Julidochromis transcriptus" },
      references: { authorCitation: null, wikipediaUrl: null, inaturalistUrl: null, powoUrl: null, gbifUrl: null },
      salinityMinPpt: 0,
      salinityMaxPpt: 0.5,
      aliases: [{ alias: "Masked Julii", aliasType: "COMMON_NAME", notes: "Common spelling variant", source: null }],
      profile: { ...nullProfile, lifespan: "5–8 years", minimumGroupSize: 1, maxSize: "3–4 in", tempMin: 74, tempMax: 80, phMin: 7.8, phMax: 9, ghMin: 8, ghMax: 20, khMin: 8, khMax: 18, preferredHardness: "Hard, alkaline water", breedingNotes: "Cave-spawning cichlid; established pairs may become territorial.", flowRequirement: "Moderate circulation", notes: "Provide rockwork with caves and visual barriers." },
      regionalStatus: mockRegionalStatus(input)
    });
  }
  const genusOnly = Boolean(input.genus && !input.species);
  const scientific = [titleCase(input.genus), genusOnly ? "sp." : input.species.toLowerCase() || null].filter(Boolean).join(" ") || null;
  return speciesMagicFillDraftSchema.parse({
    confidence: "LOW",
    summary: "Eddy normalized the supplied names but could not safely infer missing husbandry facts with the local provider.",
    warnings: [genusOnly ? "Only genus could be resolved; species left as sp." : "Verify taxonomy, aliases, and care values against a trusted species reference."],
    canonical: { category: input.category, commonName: input.commonName || null, genus: titleCase(input.genus), species: genusOnly ? "sp." : input.species.toLowerCase() || null, variety: input.variety || null, cultivar: input.cultivar || null, scientificDisplayName: scientific },
    references: { authorCitation: normalizeAuthorCitation(input.authorCitation), wikipediaUrl: validInputUrl(input.wikipediaUrl), inaturalistUrl: validInputUrl(input.inaturalistUrl), powoUrl: input.category === "PLANT" ? validInputUrl(input.powoUrl) : null, gbifUrl: validInputUrl(input.gbifUrl) },
    salinityMinPpt: null, salinityMaxPpt: null, aliases: [], profile: { ...nullProfile }, regionalStatus: mockRegionalStatus(input)
  });
}

function validInputUrl(value: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function sanitizeDraft(value: unknown, input: SpeciesMagicFillInput): SpeciesMagicFillDraft {
  const draft = speciesMagicFillDraftSchema.parse(value);
  const warnings = [...draft.warnings];
  if (draft.canonical.category !== input.category) {
    warnings.push(`Eddy proposes changing the category from ${input.category.toLowerCase()} to ${draft.canonical.category.toLowerCase()}. Applying the draft will update the form category; review it before saving.`);
  }
  draft.references.authorCitation = normalizeAuthorCitation(draft.references.authorCitation);
  if (draft.canonical.genus && !draft.canonical.species) {
    draft.canonical.species = "sp.";
    draft.canonical.scientificDisplayName = [draft.canonical.genus, "sp."].join(" ");
    warnings.push("Only genus could be resolved; species left as sp.");
  }
  if (draft.canonical.category !== "PLANT" && draft.references.powoUrl) {
    draft.references.powoUrl = null;
    warnings.push("POWO reference omitted because POWO is only used for plant species in Fluxpoint.");
  }
  draft.profile.co2Requirement = draft.canonical.category === "PLANT" ? normalizeCo2Requirement(draft.profile.co2Requirement) : "UNKNOWN";
  if (draft.canonical.category === "PLANT" && draft.profile.co2Requirement === "REQUIRED") warnings.push("CO2 marked required only when the plant is genuinely impractical without injected CO2; review before saving.");
  for (const key of ["wikipediaUrl", "inaturalistUrl", "powoUrl", "gbifUrl"] as const) {
    const value = draft.references[key];
    if (!value) continue;
    const protocol = new URL(value).protocol;
    if (!["http:", "https:"].includes(protocol)) {
      draft.references[key] = null;
      warnings.push(`${key} was omitted because it was not an HTTP or HTTPS URL.`);
    }
    if (draft.references[key] && looksLikeSearchUrl(draft.references[key])) warnings.push(`${key} appears to be a search URL; prefer a direct taxon page when available.`);
  }
  const seen = new Set(input.existingAliases.map((row) => normalizeSpeciesAlias(row.alias)));
  for (const canonical of [draft.canonical.commonName, draft.canonical.scientificDisplayName]) if (canonical) seen.add(normalizeSpeciesAlias(canonical));
  draft.aliases = draft.aliases.filter((row) => {
    const key = normalizeSpeciesAlias(row.alias);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);
  if (!draft.regionalStatus.localityLabel || !draft.regionalStatus.statusScope) {
    draft.regionalStatus = { ...draft.regionalStatus, status: "UNKNOWN", sourceName: null, sourceUrl: null, confidence: null, notes: "Add collection locality to check regional invasive/restricted status." };
  }
  if (["INVASIVE", "RESTRICTED", "PROHIBITED"].includes(draft.regionalStatus.status)) warnings.push("Regional status is advisory, not legal advice. Verify current requirements with the relevant local authority before acquiring, moving, selling, or disposing of this species.");
  for (const [minKey, maxKey] of [["tempMin", "tempMax"], ["phMin", "phMax"], ["ghMin", "ghMax"], ["khMin", "khMax"]] as const) {
    const min = draft.profile[minKey]; const max = draft.profile[maxKey];
    if (typeof min === "number" && typeof max === "number" && min > max) {
      draft.profile[minKey] = max; draft.profile[maxKey] = min;
      warnings.push(`${minKey}/${maxKey} were reversed and have been reordered.`);
    }
  }
  if (draft.salinityMinPpt != null && draft.salinityMaxPpt != null && draft.salinityMinPpt > draft.salinityMaxPpt) {
    [draft.salinityMinPpt, draft.salinityMaxPpt] = [draft.salinityMaxPpt, draft.salinityMinPpt];
    warnings.push("Salinity minimum/maximum were reversed and have been reordered.");
  }
  draft.salinityMinPpt = draft.salinityMinPpt == null ? null : Math.max(0, draft.salinityMinPpt);
  draft.salinityMaxPpt = draft.salinityMaxPpt == null ? null : Math.max(0, draft.salinityMaxPpt);
  draft.warnings = [...new Set(warnings)].slice(0, 12);
  return draft;
}

const jsonSchema = {
  type: "object", additionalProperties: false,
  required: ["confidence", "summary", "warnings", "canonical", "references", "salinityMinPpt", "salinityMaxPpt", "aliases", "profile", "regionalStatus"],
  properties: {
    confidence: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] }, summary: { type: "string" }, warnings: { type: "array", items: { type: "string" } },
    canonical: { type: "object", additionalProperties: false, required: ["category", "commonName", "genus", "species", "variety", "cultivar", "scientificDisplayName"], properties: { category: { type: "string", enum: ["FISH", "INVERT", "PLANT", "CORAL", "OTHER"] }, commonName: nullableString(), genus: nullableString(), species: nullableString(), variety: nullableString(), cultivar: nullableString(), scientificDisplayName: nullableString() } },
    references: { type: "object", additionalProperties: false, required: ["authorCitation", "wikipediaUrl", "inaturalistUrl", "powoUrl", "gbifUrl"], properties: { authorCitation: nullableString(), wikipediaUrl: nullableString(), inaturalistUrl: nullableString(), powoUrl: nullableString(), gbifUrl: nullableString() } },
    salinityMinPpt: { type: ["number", "null"] }, salinityMaxPpt: { type: ["number", "null"] },
    aliases: { type: "array", items: { type: "object", additionalProperties: false, required: ["alias", "aliasType", "notes", "source"], properties: { alias: { type: "string" }, aliasType: { type: "string", enum: speciesAliasTypes }, notes: nullableString(), source: nullableString() } } },
    profile: { type: "object", additionalProperties: false, required: Object.keys(nullProfile), properties: Object.fromEntries(Object.keys(nullProfile).map((key) => [key, key === "co2Requirement" ? { type: "string", enum: co2Requirements } : ["minimumGroupSize", "tempMin", "tempMax", "phMin", "phMax", "ghMin", "ghMax", "khMin", "khMax", "maxHeight", "maxSpread"].includes(key) ? { type: ["number", "null"] } : nullableString()])) },
    regionalStatus: { type: "object", additionalProperties: false, required: ["status", "localityLabel", "statusScope", "sourceName", "sourceUrl", "notes", "confidence"], properties: { status: { type: "string", enum: regionalSpeciesStatuses }, localityLabel: nullableString(), statusScope: nullableString(), sourceName: nullableString(), sourceUrl: nullableString(), notes: nullableString(), confidence: { type: ["string", "null"], enum: ["LOW", "MEDIUM", "HIGH", null] } } }
  }
};
function nullableString() { return { type: ["string", "null"] }; }

export const speciesMagicFillInstructions = `You are Eddy, Fluxpoint's globally aware aquarium species definition drafting assistant.

Draft the complete species definition for keeper review. Attempt every supported field instead of stopping after identity or a few care values. Work in this priority order:
1. Accepted identity and category sanity check: category, commonName, genus, species, variety, cultivar, and scientificDisplayName.
2. Accepted authorCitation whenever a reasonably confident species-level taxon is available. Treat author citation as part of canonical identity; it is often available on Wikipedia, GBIF, POWO, FishBase, Catalogue of Life, or equivalent taxonomic pages. Use null only for unresolved hybrids, cultivars, trade variants, or genuinely uncertain taxa and explain why.
3. Structured aliases: actively check for scientific synonyms, old taxonomy, alternate spellings, trade names, hobby names, common-name variants, and legacy hobby scientific names. Include alias, aliasType, notes, and source when supported.
4. salinityMinPpt and salinityMaxPpt in parts per thousand so Fluxpoint can derive freshwater, brackish, and marine habitat.
5. Conservative aquarium care fields: lifespan, minimumGroupSize, maxSize for fish, tempMin and tempMax in degrees Fahrenheit, phMin, phMax, ghMin, ghMax, khMin, khMax, maxHeight, maxSpread, growthRate, lightRequirement, co2Preference, co2Requirement for PLANT, preferredHardness, breedingNotes, flowRequirement, and notes.
6. Exact-taxon reference URLs: wikipediaUrl, inaturalistUrl, and gbifUrl for all categories; powoUrl only for PLANT. If the accepted taxon has been confidently identified, continue resolving canonical references until each supported reference field has a direct URL, canonical identifier URL, high-quality search URL, or a clear reason it could not be resolved. Prefer direct accepted taxon pages over search result URLs. Search URLs are a fallback only when a direct page cannot be found, and must be called out in warnings. Return null rather than fabricating or guessing.
7. A collection-local regionalStatus draft when regionalLookupEnabled and locality evidence are available.

For every field, return the best responsibly supported draft or null. Prefer accepted/current taxonomy and conservative hobby husbandry ranges over maximal wild extremes. Continue through all field groups even after the identity is clear. Never invent a citation, URL, alias, cultivar, variety, legal claim, or false precision.

Reference resolution is part of draft completeness. Returning only the scientific name, husbandry, or aliases without attempting authorCitation and canonical references is incomplete. Use Wikipedia as a reference hub when available: after locating the accepted article, inspect taxon identifiers or equivalent structured references and use them to resolve GBIF, iNaturalist, POWO for plants, and other canonical identifiers. Do not stop after finding the Wikipedia article.

For PLANT co2Requirement, return one of REQUIRED, RECOMMENDED, NOT_NEEDED, or UNKNOWN. Use RECOMMENDED when the plant commonly benefits from injected CO2 but remains practical without it, NOT_NEEDED for low-tech tolerant plants, UNKNOWN when evidence is weak, and REQUIRED only when the plant is genuinely impractical without injected CO2 under normal aquarium conditions. Non-plants must use UNKNOWN.

The selected category is the keeper's current input, not an immutable fact. If it is clearly inconsistent with the organism, return the likely correct canonical.category and coherent identity, lower confidence when appropriate, and add an explicit warning. A category proposal is review-only and is never saved automatically. If several taxa are plausible, choose the most likely draft, lower confidence, and explain the ambiguity in summary or warnings. Do not silently preserve an incoherent identity merely to match the selected category.

Do not repeat existing aliases or replace the canonical name with an alias. Use only well-supported alternate names, and preserve source context when available. Regional ecological or legal status is locality-specific: never infer a location, never assume United States agencies, return UNKNOWN when locality is unavailable or evidence is unreliable, and recommend verification with the relevant authority for invasive, restricted, or prohibited drafts. Return only the requested schema.`;

function looksLikeSearchUrl(value: string) {
  try {
    const url = new URL(value);
    return /search|query|results/i.test(url.pathname) || ["q", "query", "search"].some((key) => url.searchParams.has(key));
  } catch {
    return false;
  }
}

async function runOpenAi(input: SpeciesMagicFillInput) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: process.env.OPENAI_DEFAULT_RESPONSES_MODEL || process.env.OPENAI_DEFAULT_CHAT_MODEL || "gpt-4.1-mini", store: false, max_output_tokens: 3_200,
      instructions: speciesMagicFillInstructions,
      input: JSON.stringify(input), text: { format: { type: "json_schema", name: "fluxpoint_species_magic_fill", strict: true, schema: jsonSchema } } })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || "Eddy's species provider request failed.");
  const content = payload.output?.flatMap((item: any) => item.content ?? []) ?? [];
  const refusal = content.find((item: any) => item.type === "refusal")?.refusal;
  if (refusal) throw new Error(`Eddy could not draft this species: ${refusal}`);
  const text = payload.output_text ?? content.find((item: any) => typeof item.text === "string")?.text;
  if (!text) throw new Error("Eddy returned an empty species draft.");
  return { draft: sanitizeDraft(JSON.parse(text), input), tokensInput: Number(payload?.usage?.input_tokens) || null, tokensOutput: Number(payload?.usage?.output_tokens) || null };
}

export async function runSpeciesMagicFill(request: { userId: string; collectionId: string; speciesDefinitionId?: string | null; input: unknown }) {
  const rawInput = speciesMagicFillInputSchema.parse(request.input);
  const collection = await prisma.collection.findUniqueOrThrow({ where: { id: request.collectionId }, select: { localityCity: true, localityRegion: true, localityCountry: true, localityPostalCode: true, localityLabel: true } });
  const input = speciesMagicFillInputSchema.parse({ ...rawInput, collectionLocality: { ...collection, localityLabel: collection.localityLabel || buildLocalityLabel(collection), regionalLookupEnabled: hasRegionalLookupLocality(collection) } });
  if (request.speciesDefinitionId) await prisma.speciesDefinition.findFirstOrThrow({ where: { id: request.speciesDefinitionId, OR: [{ collectionId: request.collectionId }, { collectionId: null }] }, select: { id: true } });
  const status = aiProviderStatus();
  const log = await prisma.aiRequestLog.create({ data: { collectionId: request.collectionId, speciesDefinitionId: request.speciesDefinitionId || null, userId: request.userId, requestType: "HUSBANDRY", featureKey: "SPECIES_MAGIC_FILL", provider: status.provider, model: status.responsesModel, promptSummary: `Species Magic Fill: ${input.commonName || [input.genus, input.species].filter(Boolean).join(" ") || "new species"}`.slice(0, 240), input: input as never } });
  await auditCollectionAction({ collectionId: request.collectionId, entityType: "AiRequestLog", entityId: log.id, action: "EDDY_SPECIES_MAGIC_FILL_REQUESTED", summary: "Eddy Species Magic Fill and regional status check requested", actorUserId: request.userId, metadata: { speciesDefinitionId: request.speciesDefinitionId, provider: status.provider, regionalLookupEnabled: input.collectionLocality?.regionalLookupEnabled } });
  if (input.collectionLocality?.regionalLookupEnabled) await auditCollectionAction({ collectionId: request.collectionId, entityType: "AiRequestLog", entityId: log.id, action: "EDDY_REGIONAL_STATUS_CHECK_REQUESTED", summary: "Eddy regional species-status check requested", actorUserId: request.userId, metadata: { speciesDefinitionId: request.speciesDefinitionId, localityLabel: input.collectionLocality.localityLabel, country: input.collectionLocality.localityCountry } });
  try {
    const usage = await incrementEddyUsage({ userId: request.userId, collectionId: request.collectionId, featureKey: "SPECIES_MAGIC_FILL", requestLogId: log.id });
    await prisma.aiRequestLog.update({ where: { id: log.id }, data: { providerAttempted: true } });
    const baseResult = status.enabled && status.provider === "openai" && process.env.OPENAI_API_KEY ? await runOpenAi(input) : { draft: sanitizeDraft(mockSpeciesMagicFill(input), input), tokensInput: null, tokensOutput: null };
    const result = { ...baseResult, draft: sanitizeDraft(await resolveSpeciesReferences(baseResult.draft), input) };
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
