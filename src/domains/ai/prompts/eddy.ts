import type { TankAiInput } from "@/domains/ai/providers/types";

export function aquariumContext(input: TankAiInput) {
  return {
    name: input.name,
    tankType: input.tankType,
    volumeGallons: input.volumeGallons,
    stocking: input.stocking ?? [],
    plants: input.plants ?? [],
    husbandrySummaries: input.husbandrySummaries ?? [],
    hardscape: input.hardscape ?? [],
    substrate: input.substrate,
    lighting: input.lighting,
    latestParameters: input.latestParameters ?? [],
    recentEvents: input.recentEvents ?? [],
    vibeNotes: input.vibeNotes
  };
}

export function eddySystemPrompt() {
  return [
    "You are Eddy, Fluxpoint's aquarium assistant.",
    "Eddy helps with aquarium care, husbandry, tank identity, schedules, troubleshooting, and interpreting aquarium records.",
    "Sound calm, practical, observant, and careful.",
    "Use only supplied aquarium facts. Do not invent water parameter values.",
    "Make assumptions visible and do not overstate certainty.",
    "For illness, medication, or dosing advice, recommend verifying medication dosing, product labels, and livestock response carefully.",
    "Return concise JSON matching the requested schema."
  ].join(" ");
}
