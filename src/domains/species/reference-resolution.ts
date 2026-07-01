import type { SpeciesCategory } from "@prisma/client";

const USER_AGENT = "FluxpointReferenceResolution/1.0 (https://fluxpoint.wetlabs.dev; no-reply@wetlabs.dev)";
const FETCH_TIMEOUT_MS = 4_000;

export type ReferenceSource = "wikipedia" | "inaturalist" | "gbif" | "powo";

function cleanTaxon(value: string) {
  return value.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function plausibleCategory(category: SpeciesCategory | string, text: string) {
  const haystack = text.toLowerCase();
  if (category === "PLANT") return /\b(plant|fern|moss|alga|aquatic plant|plantae|tracheophyta|monilophyta)\b/.test(haystack);
  if (category === "FISH") return /\b(fish|actinopterygii|cichlid|cyprinid|characin|teleostei|perciformes|cypriniformes)\b/.test(haystack);
  if (category === "INVERT") return /\b(invertebrate|shrimp|crab|crayfish|snail|mollusc|mollusk|arthropod|crustacean|gastropod)\b/.test(haystack);
  if (category === "CORAL") return /\b(coral|anthozoa|scleractinia|octocoral)\b/.test(haystack);
  return true;
}

function isSearchUrl(url: URL) {
  return /search|query|results/i.test(url.pathname) || ["q", "query", "search"].some((key) => url.searchParams.has(key));
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

async function fetchText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { accept: "text/html,application/json;q=0.9,*/*;q=0.8", "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

function sourceMatchesUrl(source: ReferenceSource, url: URL) {
  if (source === "wikipedia") return url.hostname === "en.wikipedia.org" && url.pathname.startsWith("/wiki/");
  if (source === "inaturalist") return url.hostname === "www.inaturalist.org" && /^\/taxa\/\d+/.test(url.pathname);
  if (source === "gbif") return url.hostname === "www.gbif.org" && /^\/species\/\d+/.test(url.pathname);
  if (source === "powo") return url.hostname === "powo.science.kew.org" && url.pathname.startsWith("/taxon/");
  return false;
}

async function verifyWikipedia(url: URL, expectedTaxon: string, expectedCategory: SpeciesCategory | string) {
  const title = decodeURIComponent(url.pathname.replace(/^\/wiki\//, "")).replaceAll("_", " ");
  const params = new URLSearchParams({ action: "query", format: "json", redirects: "1", prop: "extracts|pageprops", exintro: "1", explaintext: "1", titles: title });
  const payload = await fetchJson<any>(`https://en.wikipedia.org/w/api.php?${params.toString()}`);
  const page = Object.values(payload?.query?.pages ?? {})[0] as any;
  if (!page || page.missing) return false;
  const expected = cleanTaxon(expectedTaxon);
  const pageTitle = cleanTaxon(String(page.title ?? ""));
  const extract = cleanTaxon(String(page.extract ?? ""));
  return (pageTitle === expected || extract.includes(expected)) && plausibleCategory(expectedCategory, `${page.title ?? ""} ${page.extract ?? ""}`);
}

async function verifyINaturalist(url: URL, expectedTaxon: string, expectedCategory: SpeciesCategory | string) {
  const id = url.pathname.match(/^\/taxa\/(\d+)/)?.[1];
  if (!id) return false;
  const payload = await fetchJson<any>(`https://api.inaturalist.org/v1/taxa/${id}`);
  const taxon = payload?.results?.[0];
  const expected = cleanTaxon(expectedTaxon);
  const names = [taxon?.name, taxon?.matched_term, ...(taxon?.preferred_common_name ? [taxon.preferred_common_name] : [])].map((value) => cleanTaxon(String(value ?? "")));
  return names.some((name) => name === expected || name.includes(expected)) && plausibleCategory(expectedCategory, `${taxon?.iconic_taxon_name ?? ""} ${taxon?.rank ?? ""} ${taxon?.name ?? ""}`);
}

async function verifyGbif(url: URL, expectedTaxon: string, expectedCategory: SpeciesCategory | string) {
  const id = url.pathname.match(/^\/species\/(\d+)/)?.[1];
  if (!id) return false;
  const payload = await fetchJson<any>(`https://api.gbif.org/v1/species/${id}`);
  const expected = cleanTaxon(expectedTaxon);
  const names = [payload?.canonicalName, payload?.scientificName, payload?.species].map((value) => cleanTaxon(String(value ?? "")));
  const accepted = !payload?.taxonomicStatus || ["ACCEPTED", "DOUBTFUL"].includes(String(payload.taxonomicStatus).toUpperCase());
  return accepted && names.some((name) => name === expected || name.includes(expected)) && plausibleCategory(expectedCategory, `${payload?.kingdom ?? ""} ${payload?.phylum ?? ""} ${payload?.class ?? ""} ${payload?.order ?? ""}`);
}

async function verifyPowo(url: URL, expectedTaxon: string, expectedCategory: SpeciesCategory | string) {
  if (expectedCategory !== "PLANT") return false;
  const text = await fetchText(url.toString());
  if (!text) return false;
  return cleanTaxon(text).includes(cleanTaxon(expectedTaxon)) && plausibleCategory("PLANT", text);
}

export async function verifyReferenceUrl(source: ReferenceSource, value: string | null | undefined, expectedTaxon: string, expectedCategory: SpeciesCategory | string) {
  if (!value || !expectedTaxon) return { ok: false, reason: "missing-url-or-taxon" };
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, reason: "invalid-url" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { ok: false, reason: "invalid-protocol" };
  if (isSearchUrl(url)) return { ok: false, reason: "search-url" };
  if (!sourceMatchesUrl(source, url)) return { ok: false, reason: "wrong-source" };
  const ok = source === "wikipedia"
    ? await verifyWikipedia(url, expectedTaxon, expectedCategory)
    : source === "inaturalist"
      ? await verifyINaturalist(url, expectedTaxon, expectedCategory)
      : source === "gbif"
        ? await verifyGbif(url, expectedTaxon, expectedCategory)
        : await verifyPowo(url, expectedTaxon, expectedCategory);
  return { ok, reason: ok ? null : "taxon-or-category-mismatch" };
}
