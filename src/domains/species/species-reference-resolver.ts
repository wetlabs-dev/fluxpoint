import type { SpeciesMagicFillDraft } from "@/domains/species/species-magic-fill";
import { verifyReferenceUrl, type ReferenceSource } from "@/domains/species/reference-resolution";
import { normalizeAuthorCitation } from "@/lib/format/species";

type ReferenceKey = keyof SpeciesMagicFillDraft["references"];
type ReferencePatch = Partial<Record<ReferenceKey, string | null>>;

type WikipediaMatch = {
  url: string | null;
  wikidataId: string | null;
  authorCitation: string | null;
};

type WikidataClaims = {
  inaturalistId: string | null;
  gbifId: string | null;
  powoId: string | null;
};

const USER_AGENT = "FluxpointSpeciesMagicFill/1.0 (https://fluxpoint.wetlabs.dev; no-reply@wetlabs.dev)";
const FETCH_TIMEOUT_MS = 3_500;
const WIKIDATA_IDS = {
  gbif: "P846",
  inaturalist: "P3151",
  powo: "P5037"
} as const;

function canonicalScientificName(draft: SpeciesMagicFillDraft) {
  const genus = draft.canonical.genus?.trim();
  const species = draft.canonical.species?.trim();
  if (!genus || !species || species.toLowerCase() === "sp.") return null;
  return `${genus} ${species}`;
}

function hasConfidentSpeciesIdentity(draft: SpeciesMagicFillDraft) {
  return draft.confidence !== "LOW" && Boolean(canonicalScientificName(draft));
}

function parseUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url : null;
  } catch {
    return null;
  }
}

function looksLikeSearchUrl(value: string | null | undefined) {
  const url = parseUrl(value);
  if (!url) return false;
  return /search|query|results/i.test(url.pathname) || ["q", "query", "search"].some((key) => url.searchParams.has(key));
}

function shouldReplaceUrl(value: string | null | undefined) {
  return !parseUrl(value) || looksLikeSearchUrl(value);
}

function cleanAuthorCitation(value: unknown) {
  if (typeof value !== "string") return null;
  const cleaned = value
    .replace(/<[^>]+>/g, "")
    .replace(/\{\{(?:small|nowrap|author|aut|taxon authority)\|([^{}]+)\}\}/gi, "$1")
    .replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g, "$1")
    .replace(/&nbsp;/g, " ")
    .replace(/[{}]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned || cleaned.length > 240) return null;
  return normalizeAuthorCitation(cleaned);
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json", "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    });
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    return null;
  }
}

function wikipediaUrl(title: string) {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(" ", "_")).replaceAll("%2F", "/")}`;
}

function pageLooksRelevant(page: any, scientificName: string) {
  const normalizedName = scientificName.toLowerCase();
  const title = String(page?.title ?? "").replaceAll("_", " ").toLowerCase();
  const taxonName = String(page?.pageprops?.["wikibase-shortdesc"] ?? "").toLowerCase();
  const content = String(page?.revisions?.[0]?.slots?.main?.["*"] ?? page?.revisions?.[0]?.["*"] ?? "").toLowerCase();
  return title === normalizedName || title.includes(normalizedName) || content.includes(`| binomial = ${normalizedName}`) || content.includes(`| species = ${normalizedName.split(" ")[1]}`) || taxonName.includes("species");
}

function extractWikipediaAuthority(page: any) {
  const content = String(page?.revisions?.[0]?.slots?.main?.["*"] ?? page?.revisions?.[0]?.["*"] ?? "");
  const match = content.match(/\|\s*(?:authority|binomial_authority|species_authority)\s*=\s*([^\n|]+)/i);
  return cleanAuthorCitation(match?.[1]);
}

async function queryWikipediaByTitle(scientificName: string): Promise<WikipediaMatch | null> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    redirects: "1",
    prop: "pageprops|revisions",
    rvprop: "content",
    rvslots: "main",
    titles: scientificName
  });
  const payload = await fetchJson<any>(`https://en.wikipedia.org/w/api.php?${params.toString()}`);
  const page = Object.values(payload?.query?.pages ?? {})[0] as any;
  if (!page || page.missing || !pageLooksRelevant(page, scientificName)) return null;
  return {
    url: wikipediaUrl(page.title),
    wikidataId: typeof page.pageprops?.wikibase_item === "string" ? page.pageprops.wikibase_item : null,
    authorCitation: extractWikipediaAuthority(page)
  };
}

async function searchWikipedia(scientificName: string): Promise<WikipediaMatch | null> {
  const searchParams = new URLSearchParams({ action: "query", format: "json", list: "search", srsearch: `"${scientificName}" species`, srlimit: "5" });
  const searchPayload = await fetchJson<any>(`https://en.wikipedia.org/w/api.php?${searchParams.toString()}`);
  const matches = searchPayload?.query?.search ?? [];
  for (const row of matches) {
    const title = String(row?.title ?? "");
    if (!title) continue;
    const titleParams = new URLSearchParams({
      action: "query",
      format: "json",
      redirects: "1",
      prop: "pageprops|revisions",
      rvprop: "content",
      rvslots: "main",
      titles: title
    });
    const payload = await fetchJson<any>(`https://en.wikipedia.org/w/api.php?${titleParams.toString()}`);
    const page = Object.values(payload?.query?.pages ?? {})[0] as any;
    if (!page || page.missing || !pageLooksRelevant(page, scientificName)) continue;
    return {
      url: wikipediaUrl(page.title),
      wikidataId: typeof page.pageprops?.wikibase_item === "string" ? page.pageprops.wikibase_item : null,
      authorCitation: extractWikipediaAuthority(page)
    };
  }
  return null;
}

async function resolveWikipedia(scientificName: string) {
  return await queryWikipediaByTitle(scientificName) ?? await searchWikipedia(scientificName);
}

function firstStringClaim(entity: any, property: string) {
  const value = entity?.claims?.[property]?.[0]?.mainsnak?.datavalue?.value;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function resolveWikidataClaims(wikidataId: string | null): Promise<WikidataClaims> {
  if (!wikidataId) return { inaturalistId: null, gbifId: null, powoId: null };
  const payload = await fetchJson<any>(`https://www.wikidata.org/wiki/Special:EntityData/${encodeURIComponent(wikidataId)}.json`);
  const entity = payload?.entities?.[wikidataId];
  return {
    inaturalistId: firstStringClaim(entity, WIKIDATA_IDS.inaturalist),
    gbifId: firstStringClaim(entity, WIKIDATA_IDS.gbif),
    powoId: firstStringClaim(entity, WIKIDATA_IDS.powo)
  };
}

function isGoodGbifMatch(payload: any, scientificName: string, category: SpeciesMagicFillDraft["canonical"]["category"]) {
  if (!payload?.usageKey) return false;
  const confidence = Number(payload.confidence ?? 0);
  const canonical = String(payload.canonicalName ?? payload.scientificName ?? "").toLowerCase();
  const group = `${payload.kingdom ?? ""} ${payload.phylum ?? ""} ${payload.class ?? ""} ${payload.order ?? ""}`.toLowerCase();
  const plausible = category === "PLANT" ? /plantae|tracheophyta|bryophyta|chlorophyta/.test(group)
    : category === "FISH" ? /actinopterygii|chondrichthyes|teleostei|chordata/.test(group)
      : category === "INVERT" ? /arthropoda|mollusca|cnidaria|annelida|crustacea|gastropoda/.test(group)
        : category === "CORAL" ? /cnidaria|anthozoa|scleractinia/.test(group)
          : true;
  return confidence >= 80 && canonical.includes(scientificName.toLowerCase()) && plausible;
}

async function resolveGbif(scientificName: string, category: SpeciesMagicFillDraft["canonical"]["category"]) {
  const params = new URLSearchParams({ name: scientificName, rank: "SPECIES" });
  const payload = await fetchJson<any>(`https://api.gbif.org/v1/species/match?${params.toString()}`);
  if (!isGoodGbifMatch(payload, scientificName, category)) return { url: null, authorCitation: null };
  return {
    url: `https://www.gbif.org/species/${payload.usageKey}`,
    authorCitation: cleanAuthorCitation(payload.authorship)
  };
}

async function resolveINaturalist(scientificName: string) {
  const params = new URLSearchParams({ q: scientificName, rank: "species", per_page: "5" });
  const payload = await fetchJson<any>(`https://api.inaturalist.org/v1/taxa?${params.toString()}`);
  const exact = (payload?.results ?? []).find((row: any) => String(row?.name ?? "").toLowerCase() === scientificName.toLowerCase());
  const id = exact?.id;
  return typeof id === "number" || typeof id === "string" ? `https://www.inaturalist.org/taxa/${id}` : null;
}

async function verifyDraftReferenceUrls(draft: SpeciesMagicFillDraft, scientificName: string) {
  const checks: Array<[ReferenceKey, ReferenceSource]> = [
    ["wikipediaUrl", "wikipedia"],
    ["inaturalistUrl", "inaturalist"],
    ["gbifUrl", "gbif"],
    ["powoUrl", "powo"]
  ];
  await Promise.all(checks.map(async ([key, source]) => {
    const value = draft.references[key];
    if (!value) return;
    if (key === "powoUrl" && draft.canonical.category !== "PLANT") {
      draft.references[key] = null;
      return;
    }
    const result = await verifyReferenceUrl(source, value, scientificName, draft.canonical.category);
    if (!result.ok) draft.references[key] = null;
  }));
}

function wikidataReferenceUrls(claims: WikidataClaims, category: SpeciesMagicFillDraft["canonical"]["category"]): ReferencePatch {
  return {
    gbifUrl: claims.gbifId ? `https://www.gbif.org/species/${claims.gbifId}` : null,
    inaturalistUrl: claims.inaturalistId ? `https://www.inaturalist.org/taxa/${claims.inaturalistId}` : null,
    powoUrl: category === "PLANT" && claims.powoId ? `https://powo.science.kew.org/taxon/${claims.powoId}` : null
  };
}

function mergeReferencePatch(draft: SpeciesMagicFillDraft, patch: ReferencePatch) {
  for (const [key, value] of Object.entries(patch) as [ReferenceKey, string | null][]) {
    if (!value) continue;
    if (key === "authorCitation") {
      if (!draft.references.authorCitation) draft.references.authorCitation = value;
      continue;
    }
    if (shouldReplaceUrl(draft.references[key])) draft.references[key] = value;
  }
}

export async function resolveSpeciesReferences(draft: SpeciesMagicFillDraft): Promise<SpeciesMagicFillDraft> {
  if (!hasConfidentSpeciesIdentity(draft)) return draft;
  const scientificName = canonicalScientificName(draft);
  if (!scientificName) return draft;

  const next = speciesDraftClone(draft);
  await verifyDraftReferenceUrls(next, scientificName);
  const wikipedia = shouldReplaceUrl(next.references.wikipediaUrl) || !next.references.authorCitation ? await resolveWikipedia(scientificName) : null;
  if (wikipedia) mergeReferencePatch(next, { wikipediaUrl: wikipedia.url, authorCitation: wikipedia.authorCitation });

  const [wikidataClaims, gbif, inaturalist] = await Promise.all([
    resolveWikidataClaims(wikipedia?.wikidataId ?? null),
    shouldReplaceUrl(next.references.gbifUrl) || !next.references.authorCitation ? resolveGbif(scientificName, next.canonical.category) : Promise.resolve({ url: null, authorCitation: null }),
    shouldReplaceUrl(next.references.inaturalistUrl) ? resolveINaturalist(scientificName) : Promise.resolve(null)
  ]);

  mergeReferencePatch(next, wikidataReferenceUrls(wikidataClaims, next.canonical.category));
  mergeReferencePatch(next, { gbifUrl: gbif.url, authorCitation: gbif.authorCitation, inaturalistUrl: inaturalist });

  if (next.canonical.category !== "PLANT") next.references.powoUrl = null;
  return next;
}

function speciesDraftClone(draft: SpeciesMagicFillDraft): SpeciesMagicFillDraft {
  return {
    ...draft,
    warnings: [...draft.warnings],
    canonical: { ...draft.canonical },
    references: { ...draft.references },
    aliases: draft.aliases.map((alias) => ({ ...alias })),
    variantSuggestion: draft.variantSuggestion ? { ...draft.variantSuggestion } : null,
    profile: { ...draft.profile },
    regionalStatus: { ...draft.regionalStatus }
  };
}
