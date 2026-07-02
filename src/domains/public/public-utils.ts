export function publicSlug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "public";
}

export function publicCollectionPath(slug: string) {
  return `/browse/${slug}`;
}

export function publicAquariumPath(collectionSlug: string, aquariumSlug: string) {
  return `/browse/${collectionSlug}/aquariums/${aquariumSlug}`;
}

export function money(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}
