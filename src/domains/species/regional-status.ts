import type { RegionalSpeciesStatus, RegionalStatusConfidence } from "@prisma/client";

export const regionalSpeciesStatuses: RegionalSpeciesStatus[] = ["UNKNOWN", "NOT_LISTED", "WATCHLIST", "ESTABLISHED_NON_NATIVE", "INVASIVE", "RESTRICTED", "PROHIBITED"];
export const regionalStatusConfidences: RegionalStatusConfidence[] = ["LOW", "MEDIUM", "HIGH"];
export const concerningRegionalStatuses: RegionalSpeciesStatus[] = ["WATCHLIST", "ESTABLISHED_NON_NATIVE", "INVASIVE", "RESTRICTED", "PROHIBITED"];
export const restrictedRegionalStatuses: RegionalSpeciesStatus[] = ["RESTRICTED", "PROHIBITED"];

export const regionalStatusLabels: Record<RegionalSpeciesStatus, string> = {
  UNKNOWN: "Unknown", NOT_LISTED: "Not listed locally", WATCHLIST: "Watchlist", ESTABLISHED_NON_NATIVE: "Established non-native",
  INVASIVE: "Potentially invasive", RESTRICTED: "Restricted", PROHIBITED: "Prohibited"
};

export function isConcerningRegionalStatus(status?: string | null): status is RegionalSpeciesStatus {
  return concerningRegionalStatuses.includes(status as RegionalSpeciesStatus);
}
export function isRestrictedRegionalStatus(status?: string | null): status is RegionalSpeciesStatus {
  return restrictedRegionalStatuses.includes(status as RegionalSpeciesStatus);
}

export const neverReleaseMessage = "Never release aquarium plants, animals, substrate, or water into local waterways.";

export function regionalStatusWarning(status: RegionalSpeciesStatus, locality?: string | null) {
  const place = locality ? ` for ${locality}` : " for your collection locality";
  if (status === "WATCHLIST") return `This species is on a regional watchlist${place}.`;
  if (status === "ESTABLISHED_NON_NATIVE") return `This species is established outside its native range${place}.`;
  if (status === "INVASIVE") return `This species may be invasive${place}. Handle it responsibly.`;
  if (status === "RESTRICTED" || status === "PROHIBITED") return `This species may be ${status.toLowerCase()}${place}. Verify local regulations before acquiring or moving it.`;
  return "No concerning regional status is recorded.";
}

export function hasRegionalLookupLocality(locality: { localityCountry?: string | null; localityRegion?: string | null; localityCity?: string | null; localityPostalCode?: string | null }) {
  return Boolean(locality.localityCountry && (locality.localityRegion || locality.localityCity || locality.localityPostalCode));
}

export function buildLocalityLabel(locality: { localityCity?: string | null; localityRegion?: string | null; localityCountry?: string | null }) {
  let country = locality.localityCountry?.trim().toUpperCase() || null;
  if (country?.length === 2) {
    try { country = new Intl.DisplayNames(["en"], { type: "region" }).of(country) || country; } catch { /* retain code */ }
  }
  return [locality.localityCity, locality.localityRegion, country].map((value) => value?.trim()).filter(Boolean).join(", ") || null;
}
