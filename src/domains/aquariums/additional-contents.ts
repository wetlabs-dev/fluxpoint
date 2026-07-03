export const additionalContentCategories = [
  "PLANT",
  "FISH",
  "INVERTEBRATE",
  "CORAL",
  "HARDSCAPE",
  "EQUIPMENT",
  "SUBSTRATE",
  "BOTANICAL",
  "UNKNOWN",
  "NOTE",
  "OTHER"
] as const;

export type AdditionalContentCategory = (typeof additionalContentCategories)[number];

export const additionalContentConfidences = ["UNKNOWN", "ROUGH", "CONFIDENT"] as const;
export type AdditionalContentConfidence = (typeof additionalContentConfidences)[number];

export const additionalContentIntents = ["INFORMATIONAL", "NEEDS_STRUCTURED_RECORD", "INTENTIONALLY_UNSTRUCTURED"] as const;
export type AdditionalContentIntent = (typeof additionalContentIntents)[number];

export const additionalContentCategoryLabels: Record<AdditionalContentCategory, string> = {
  PLANT: "Plants",
  FISH: "Fish",
  INVERTEBRATE: "Invertebrates",
  CORAL: "Corals",
  HARDSCAPE: "Hardscape",
  EQUIPMENT: "Equipment",
  SUBSTRATE: "Substrate",
  BOTANICAL: "Botanicals",
  UNKNOWN: "Unknown",
  NOTE: "Notes",
  OTHER: "Other"
};

export const additionalContentConfidenceLabels: Record<AdditionalContentConfidence, string> = {
  UNKNOWN: "Unknown confidence",
  ROUGH: "Rough estimate",
  CONFIDENT: "Confident"
};

export const additionalContentIntentLabels: Record<AdditionalContentIntent, string> = {
  INFORMATIONAL: "Informational",
  NEEDS_STRUCTURED_RECORD: "Needs structured record",
  INTENTIONALLY_UNSTRUCTURED: "Intentionally unstructured"
};

export type AdditionalContentContextRow = {
  category: AdditionalContentCategory | string;
  description: string;
  approximateQuantity: string | null;
  confidence: AdditionalContentConfidence | string;
  intent: AdditionalContentIntent | string;
  includeInEddyContext?: boolean;
  notes: string | null;
};

export function additionalContentInventoryType(category: string) {
  if (category === "FISH") return "FISH";
  if (category === "INVERTEBRATE") return "INVERT";
  if (category === "PLANT") return "PLANT";
  if (category === "CORAL") return "CORAL";
  if (category === "HARDSCAPE") return "HARDSCAPE";
  if (category === "EQUIPMENT") return "EQUIPMENT";
  if (category === "SUBSTRATE") return "SUBSTRATE";
  if (category === "BOTANICAL") return "BOTANICAL";
  return "OTHER";
}

export function summarizeAdditionalContents(rows: AdditionalContentContextRow[]) {
  const visible = rows.filter((row) => row.includeInEddyContext !== false);
  return visible.map((row) => ({
    category: row.category,
    categoryLabel: additionalContentCategoryLabels[row.category as AdditionalContentCategory] ?? String(row.category).toLowerCase(),
    description: row.description,
    approximateQuantity: row.approximateQuantity,
    confidence: row.confidence,
    confidenceLabel: additionalContentConfidenceLabels[row.confidence as AdditionalContentConfidence] ?? String(row.confidence).toLowerCase(),
    intent: row.intent,
    intentLabel: additionalContentIntentLabels[row.intent as AdditionalContentIntent] ?? String(row.intent).toLowerCase(),
    notes: row.notes,
    handling: "Additional tank content: remember this context, but do not treat it as precise inventory or create structured records automatically."
  }));
}

export function formatAdditionalContentsForEddy(rows: AdditionalContentContextRow[]) {
  const summarized = summarizeAdditionalContents(rows);
  if (!summarized.length) return "No additional unstructured tank contents are recorded.";
  return summarized.map((row) => {
    const quantity = row.approximateQuantity ? ` · approx ${row.approximateQuantity}` : "";
    const notes = row.notes ? ` · notes: ${row.notes}` : "";
    return `${row.categoryLabel}: ${row.description}${quantity} · ${row.confidenceLabel} · ${row.intentLabel}${notes}`;
  }).join("\n");
}

export function additionalContentCautions(rows: AdditionalContentContextRow[]) {
  const summarized = summarizeAdditionalContents(rows);
  const cautions: string[] = [];
  if (summarized.some((row) => ["FISH", "INVERTEBRATE"].includes(String(row.category)) && row.confidence !== "CONFIDENT")) {
    cautions.push("Additional fish or invertebrate notes increase uncertainty until converted into structured inventory with species and quantities.");
  }
  if (summarized.some((row) => row.category === "PLANT" && row.approximateQuantity)) {
    cautions.push("Additional plant notes can modestly reduce concern only as qualitative context, not as a precise biomass calculation.");
  }
  if (summarized.some((row) => row.category === "HARDSCAPE")) {
    cautions.push("Hardscape notes can affect territory, swimming space, and line-of-sight assumptions.");
  }
  if (summarized.some((row) => row.intent === "NEEDS_STRUCTURED_RECORD")) {
    cautions.push("Some remembered contents are marked as needing structured records; review Inventory before relying on them operationally.");
  }
  return cautions;
}
