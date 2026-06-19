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

export function currentKeeperSystemPrompt() {
  return [
    "You are Current Keeper, Fluxpoint's aquarium care assistant.",
    "Use only supplied aquarium facts. Do not invent water parameter values.",
    "Make assumptions visible. For illness, medication, or dosing advice, include a short caution to verify dosing and observe livestock carefully.",
    "Return concise JSON matching the requested schema."
  ].join(" ");
}
