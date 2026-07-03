export type InhabitantGroupableItem = {
  id: string;
  aquariumId?: string | null;
  itemType: string;
  speciesDefinitionId?: string | null;
  speciesVariantId?: string | null;
  name: string;
  quantity: number;
  unit?: string | null;
  status: string;
  acquiredAt?: Date | string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  notes?: string | null;
  maleCountApprox?: number | null;
  femaleCountApprox?: number | null;
  source?: { name?: string | null } | null;
  acquiredFrom?: string | null;
  speciesDefinition?: {
    commonName?: string | null;
    scientificName?: string | null;
    genus?: string | null;
    species?: string | null;
    category?: string | null;
    maxSize?: string | null;
    bioloadClass?: string | null;
    tempMin?: number | null;
    tempMax?: number | null;
    phMin?: number | null;
    phMax?: number | null;
    ghMin?: number | null;
    ghMax?: number | null;
    khMin?: number | null;
    khMax?: number | null;
    tdsMin?: number | null;
    tdsMax?: number | null;
    minimumGroupSize?: number | null;
    salinityMin?: number | null;
    salinityMax?: number | null;
    careNotes?: string | null;
    notes?: string | null;
    husbandryGuide?: { fields?: unknown } | null;
  } | null;
  speciesVariant?: {
    name?: string | null;
    displayName?: string | null;
    variantType?: string | null;
  } | null;
};

export type AquariumInhabitantGroup<TItem extends InhabitantGroupableItem = InhabitantGroupableItem> = {
  key: string;
  groupable: boolean;
  itemType: string;
  aquariumId: string | null;
  speciesDefinitionId: string | null;
  speciesVariantId: string | null;
  displayName: string;
  scientificName: string | null;
  variantName: string | null;
  totalQuantity: number;
  unit: string | null;
  batchCount: number;
  status: string;
  sourceSummary: string;
  dateSummary: string;
  notesSummary: string | null;
  primaryItem: TItem;
  husbandryItem: TItem | null;
  items: TItem[];
};

const activeAquariumStatuses = new Set(["ACTIVE", "IN_AQUARIUM"]);

export function getInhabitantGroupKey(item: InhabitantGroupableItem) {
  const aquariumId = item.aquariumId ?? "no-aquarium";
  if (item.speciesDefinitionId) {
    return `${aquariumId}:${item.itemType}:species:${item.speciesDefinitionId}:variant:${item.speciesVariantId ?? "base"}`;
  }
  const normalizedName = normalizeCustomName(item.name);
  if (normalizedName) return `${aquariumId}:${item.itemType}:custom:${normalizedName}`;
  return `${aquariumId}:${item.itemType}:item:${item.id}`;
}

export function groupAquariumInhabitants<TItem extends InhabitantGroupableItem>(items: TItem[]) {
  const groups = new Map<string, TItem[]>();
  const ungrouped: TItem[] = [];
  for (const item of items) {
    if (!isActiveAquariumBatch(item)) {
      ungrouped.push(item);
      continue;
    }
    const key = getInhabitantGroupKey(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  for (const item of ungrouped) groups.set(`${item.aquariumId ?? "no-aquarium"}:${item.itemType}:item:${item.id}`, [item]);
  return [...groups.entries()]
    .map(([key, groupedItems]) => summarizeInhabitantGroup(key, groupedItems))
    .sort((a, b) => a.displayName.localeCompare(b.displayName) || a.key.localeCompare(b.key));
}

export function summarizeInhabitantGroup<TItem extends InhabitantGroupableItem>(key: string, items: TItem[]): AquariumInhabitantGroup<TItem> {
  const sorted = [...items].sort(compareBatchesNewestFirst);
  const primaryItem = sorted[0];
  const husbandryItem = sorted.find((item) => item.speciesDefinitionId) ?? null;
  const sources = uniqueStrings(sorted.map((item) => item.source?.name ?? item.acquiredFrom ?? null));
  const dates = sorted.map((item) => coerceDate(item.acquiredAt)).filter(Boolean) as Date[];
  const statuses = uniqueStrings(sorted.map((item) => item.status));
  const units = uniqueStrings(sorted.map((item) => item.unit ?? null));
  const notes = uniqueStrings(sorted.map((item) => item.notes ?? null));
  const displayName = primaryItem.speciesVariant?.displayName || primaryItem.speciesVariant?.name || primaryItem.speciesDefinition?.commonName || primaryItem.name;
  const scientificName = primaryItem.speciesDefinition?.scientificName || [primaryItem.speciesDefinition?.genus, primaryItem.speciesDefinition?.species].filter(Boolean).join(" ") || null;
  return {
    key,
    groupable: Boolean(primaryItem.speciesDefinitionId || normalizeCustomName(primaryItem.name)),
    itemType: primaryItem.itemType,
    aquariumId: primaryItem.aquariumId ?? null,
    speciesDefinitionId: primaryItem.speciesDefinitionId ?? null,
    speciesVariantId: primaryItem.speciesVariantId ?? null,
    displayName,
    scientificName,
    variantName: primaryItem.speciesVariant ? primaryItem.speciesVariant.displayName || primaryItem.speciesVariant.name || null : null,
    totalQuantity: sorted.reduce((sum, item) => sum + item.quantity, 0),
    unit: units.length === 1 ? units[0] : null,
    batchCount: sorted.length,
    status: statuses.length === 1 ? statuses[0] : "MIXED",
    sourceSummary: sources.length === 0 ? "No source" : sources.length === 1 ? sources[0] : "Multiple sources",
    dateSummary: summarizeDates(dates, sorted.length),
    notesSummary: notes.length === 1 && sorted.length === 1 ? notes[0] : notes.length === 1 ? "1 batch has notes." : notes.length > 1 ? `${notes.length} batches have notes.` : null,
    primaryItem,
    husbandryItem,
    items: sorted
  };
}

export function formatInhabitantGroupQuantity(group: Pick<AquariumInhabitantGroup, "totalQuantity" | "unit">) {
  return `qty ${formatQuantity(group.totalQuantity)} ${group.unit ?? "mixed units"}`;
}

export function describeInhabitantGroupForContext(group: AquariumInhabitantGroup) {
  const batchText = group.batchCount === 1 ? "1 batch" : `${group.batchCount} batches`;
  return `${group.displayName} — ${formatQuantity(group.totalQuantity)} ${group.unit ?? "units"} across ${batchText}`;
}

function isActiveAquariumBatch(item: InhabitantGroupableItem) {
  return Boolean(item.aquariumId) && activeAquariumStatuses.has(item.status);
}

function normalizeCustomName(name: string | null | undefined) {
  const normalized = String(name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  return normalized.length >= 2 ? normalized : null;
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];
}

function coerceDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function compareBatchesNewestFirst(a: InhabitantGroupableItem, b: InhabitantGroupableItem) {
  const bDate = coerceDate(b.acquiredAt)?.getTime() ?? coerceDate(b.createdAt)?.getTime() ?? coerceDate(b.updatedAt)?.getTime() ?? 0;
  const aDate = coerceDate(a.acquiredAt)?.getTime() ?? coerceDate(a.createdAt)?.getTime() ?? coerceDate(a.updatedAt)?.getTime() ?? 0;
  return bDate - aDate || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
}

function summarizeDates(dates: Date[], batchCount: number) {
  if (!dates.length) return batchCount > 1 ? `Added across ${batchCount} batches` : "No date";
  const ordered = [...dates].sort((a, b) => a.getTime() - b.getTime());
  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  const sameDay = first.toDateString() === last.toDateString();
  if (batchCount === 1 || sameDay) return formatDate(first);
  return `${formatDate(first)}–${formatDate(last)}`;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function formatQuantity(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}
