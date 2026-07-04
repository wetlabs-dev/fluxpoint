export type CountableInhabitantItem = {
  itemType: string;
  quantity: number;
  status?: string | null;
};

const activeItemStatuses = new Set(["ACTIVE", "IN_AQUARIUM"]);

export function summarizeInhabitantCounts(items: CountableInhabitantItem[] = []) {
  const current = items.filter((item) => !item.status || activeItemStatuses.has(item.status));
  const fish = sumByTypes(current, ["FISH"]);
  const inverts = sumByTypes(current, ["INVERT"]);
  const plants = sumByTypes(current, ["PLANT"]);
  const other = sumByTypes(current, ["BOTANICAL", "OTHER"]);
  return {
    total: fish + inverts + plants + other,
    fish,
    plants,
    inverts,
    other
  };
}

export function formatInhabitantBreakdown(counts: ReturnType<typeof summarizeInhabitantCounts>) {
  return [
    counts.fish ? `${formatQuantity(counts.fish)} fish` : null,
    counts.plants ? `${formatQuantity(counts.plants)} plants` : null,
    counts.inverts ? `${formatQuantity(counts.inverts)} inverts` : null,
    counts.other ? `${formatQuantity(counts.other)} other` : null
  ].filter(Boolean).join(" · ");
}

export function formatQuantity(value: number) {
  return Number.isInteger(value) ? String(value) : value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function sumByTypes(items: CountableInhabitantItem[], types: string[]) {
  return items.filter((item) => types.includes(item.itemType)).reduce((sum, item) => sum + item.quantity, 0);
}
