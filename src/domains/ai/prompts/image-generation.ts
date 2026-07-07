import type { TankAiInput } from "@/domains/ai/providers/types";

export function coverImagePrompt(input: TankAiInput) {
  const selected = input.customPrompt || input.selectedConceptPrompt || input.vibeNotes || input.colorNotes;
  const details = [
    input.tankType ? `${input.tankType} aquarium` : "aquarium",
    input.stocking?.length ? `inhabitants: ${input.stocking.slice(0, 8).join(", ")}` : "",
    input.plants?.length ? `plants: ${input.plants.slice(0, 8).join(", ")}` : "",
    input.additionalContents?.length ? `additional contents: ${input.additionalContents.slice(0, 6).join(", ")}` : "",
    input.hardscape?.length ? `hardscape: ${input.hardscape.slice(0, 6).join(", ")}` : "",
    input.substrate ? `substrate: ${input.substrate}` : "",
    input.lighting ? `lighting: ${input.lighting}` : ""
  ].filter(Boolean).join("; ");
  const concept = [
    input.selectedConceptTitle ? `concept: ${input.selectedConceptTitle}` : "",
    input.selectedConceptDescription ? input.selectedConceptDescription : "",
    input.selectedConceptTags?.length ? `tags: ${input.selectedConceptTags.slice(0, 8).join(", ")}` : "",
    selected ? `visual direction: ${selected}` : "visual direction: soft waterline, aquatic botanicals, subtle current"
  ].filter(Boolean).join("; ");
  return [
    "Create a square illustrated aquarium cover-card background for Fluxpoint.",
    "Style: soft modern aquatic art, calm dashboard header, atmospheric depth, no photorealism.",
    "Composition: wide-card friendly, readable dark lower overlay area, no text, no logos, no UI, no captions.",
    `Relevant aquarium context: ${details || "sparse aquarium record"}.`,
    concept,
    "If details are sparse, use abstract caustics, color, water movement, plants, and habitat mood instead of inventing exact livestock."
  ].join(" ");
}
