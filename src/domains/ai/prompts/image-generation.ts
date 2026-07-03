import type { TankAiInput } from "@/domains/ai/providers/types";

export function coverImagePrompt(input: TankAiInput) {
  const selected = input.customPrompt || input.selectedConceptPrompt || input.vibeNotes || input.colorNotes;
  return [
    "Soft aquatic dashboard cover card art for Fluxpoint.",
    "Cozy modern aquarium management visual, warm and calm, not photorealistic, no text in image.",
    "The image is a conceptual aquarium header background; do not add readable labels, logos, UI, captions, or text.",
    `Tank: ${input.name ?? "unnamed aquarium"}.`,
    `Type: ${input.tankType ?? "aquarium"}.`,
    `Inhabitants: ${(input.stocking ?? []).join(", ") || "not specified"}.`,
    `Plants: ${(input.plants ?? []).join(", ") || "not specified"}.`,
    `Additional remembered contents: ${(input.additionalContents ?? []).join(", ") || "not specified"}.`,
    `Hardscape: ${(input.hardscape ?? []).join(", ") || "not specified"}.`,
    `Substrate: ${input.substrate ?? "not specified"}.`,
    `Lighting: ${input.lighting ?? "not specified"}.`,
    input.selectedConceptTitle ? `Selected concept: ${input.selectedConceptTitle}.` : "",
    input.selectedConceptDescription ? `Concept description: ${input.selectedConceptDescription}.` : "",
    input.selectedConceptTags?.length ? `Concept tags: ${input.selectedConceptTags.join(", ")}.` : "",
    `Direction: ${selected ?? "soft waterline, aquatic botanicals, subtle current"}.`,
    "If the record has sparse details, favor abstract caustics, color, water movement, and habitat mood over invented livestock."
  ].join(" ");
}
