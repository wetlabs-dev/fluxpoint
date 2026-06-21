import type { SpeciesAliasType } from "@prisma/client";

export const speciesAliasTypes: SpeciesAliasType[] = [
  "COMMON_NAME", "TRADE_NAME", "OLD_NAME", "MISSPELLING", "SCIENTIFIC_SYNONYM", "LOCAL_NAME", "OTHER"
];

export const speciesAliasTypeLabels: Record<SpeciesAliasType, string> = {
  COMMON_NAME: "Common name",
  TRADE_NAME: "Trade name",
  OLD_NAME: "Old name",
  MISSPELLING: "Misspelling",
  SCIENTIFIC_SYNONYM: "Scientific synonym",
  LOCAL_NAME: "Local name",
  OTHER: "Other"
};

export type SpeciesAliasDraft = {
  alias: string;
  aliasType: SpeciesAliasType;
  notes: string | null;
  source: string | null;
};

export function normalizeSpeciesAlias(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

export function speciesAliasRows(formData: FormData): SpeciesAliasDraft[] {
  const names = formData.getAll("aliasName");
  const types = formData.getAll("aliasType");
  const notes = formData.getAll("aliasNotes");
  const sources = formData.getAll("aliasSource");
  const seen = new Set<string>();
  const rows: SpeciesAliasDraft[] = [];
  for (let index = 0; index < names.length && rows.length < 24; index += 1) {
    const alias = String(names[index] ?? "").trim().replace(/\s+/g, " ").slice(0, 200);
    const normalized = normalizeSpeciesAlias(alias);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    const proposedType = String(types[index] ?? "OTHER") as SpeciesAliasType;
    rows.push({
      alias,
      aliasType: speciesAliasTypes.includes(proposedType) ? proposedType : "OTHER",
      notes: String(notes[index] ?? "").trim().slice(0, 500) || null,
      source: String(sources[index] ?? "").trim().slice(0, 240) || null
    });
  }
  return rows;
}
