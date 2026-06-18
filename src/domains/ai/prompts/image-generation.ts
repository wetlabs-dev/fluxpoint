import type { TankAiInput } from "@/domains/ai/providers/types";

export function coverImagePrompt(input: TankAiInput) {
  return [
    "Soft aquatic dashboard cover card art for Fluxpoint.",
    "Cozy modern aquarium management visual, warm and calm, not photorealistic, no text in image.",
    `Tank: ${input.name ?? "unnamed aquarium"}.`,
    `Type: ${input.tankType ?? "aquarium"}.`,
    `Inhabitants: ${(input.stocking ?? []).join(", ") || "not specified"}.`,
    `Plants: ${(input.plants ?? []).join(", ") || "not specified"}.`,
    `Hardscape: ${(input.hardscape ?? []).join(", ") || "not specified"}.`,
    `Substrate: ${input.substrate ?? "not specified"}.`,
    `Lighting: ${input.lighting ?? "not specified"}.`,
    `Mood notes: ${input.vibeNotes ?? input.colorNotes ?? "soft waterline, aquatic botanicals, subtle current"}.`
  ].join(" ");
}
