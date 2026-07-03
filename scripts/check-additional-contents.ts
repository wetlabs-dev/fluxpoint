import {
  additionalContentCategories,
  additionalContentCategoryLabels,
  additionalContentConfidences,
  additionalContentConfidenceLabels,
  additionalContentIntents,
  additionalContentIntentLabels,
  additionalContentInventoryType,
  formatAdditionalContentsForEddy,
  summarizeAdditionalContents
} from "../src/domains/aquariums/additional-contents";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

for (const category of additionalContentCategories) assert(additionalContentCategoryLabels[category], `Missing label for category ${category}.`);
for (const confidence of additionalContentConfidences) assert(additionalContentConfidenceLabels[confidence], `Missing label for confidence ${confidence}.`);
for (const intent of additionalContentIntents) assert(additionalContentIntentLabels[intent], `Missing label for intent ${intent}.`);

assert(additionalContentInventoryType("FISH") === "FISH", "Fish conversion hint should map to fish inventory.");
assert(additionalContentInventoryType("INVERTEBRATE") === "INVERT", "Invertebrate conversion hint should map to invert inventory.");
assert(additionalContentInventoryType("NOTE") === "OTHER", "Notes should not imply a structured livestock record.");

const rows = summarizeAdditionalContents([
  { category: "FISH", description: "unknown fry", approximateQuantity: "several", confidence: "ROUGH", intent: "NEEDS_STRUCTURED_RECORD", includeInEddyContext: true, notes: "seen near moss" },
  { category: "NOTE", description: "private note", approximateQuantity: null, confidence: "UNKNOWN", intent: "INFORMATIONAL", includeInEddyContext: false, notes: null }
]);

assert(rows.length === 1, "Rows excluded from Eddy context should not be summarized.");
assert(rows[0].handling.includes("not treat it as precise inventory"), "Eddy handling caution should be explicit.");
assert(formatAdditionalContentsForEddy(rows).includes("unknown fry"), "Formatted Eddy context should include remembered row description.");

console.log("Additional tank contents checks passed.");
