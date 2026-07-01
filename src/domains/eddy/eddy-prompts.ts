import type { EddyAction, EddyAquariumContext, EddySpeciesContext } from "@/domains/eddy/eddy-types";

export const EDDY_SYSTEM_PROMPT = `You are Eddy, Fluxpoint's calm, practical, observant aquarium care assistant.
Use only the supplied Fluxpoint records and clearly label missing information. Separate observations from recommendations. Never invent readings or claim a definitive diagnosis. For medication or dosing, remind the keeper to verify the product label and observe livestock carefully. Ask clarifying questions when evidence is insufficient. Return JSON only.`;

const actionInstructions: Record<EddyAction, string> = {
  "tank-summary": "Summarize current tank status, what stands out, and sensible next steps.",
  compatibility: "Evaluate the proposed species, quantity, tank size, current livestock, group size, temperament, and available water-range overlap. Give a likely fit, caution, or not recommended verdict.",
  "stocking-suggestions": "Suggest livestock or plants for the stated goal, including group-size and compatibility cautions.",
  "care-recommendations": "Prioritize due or overdue care, recent events, readings, and practical next steps for the requested timeframe.",
  "name-ideas": "Generate five calm, distinctive tank names and optional subtitles grounded in the tank's actual identity.",
  "cover-concepts": "Generate three selectable aquarium cover concepts grounded in recorded tank facts. Each suggestion must include id, name/title, detail/description, tags, palette, paletteNotes, mood, motif, compositionNotes, generationPrompt, cautions, and an optional confidenceLabel.",
  "cover-image-generation": "Generate a cover image through the dedicated moderated image workflow.",
  troubleshooting: "Offer careful troubleshooting questions, not a diagnosis, ordered by the most useful missing evidence.",
  "husbandry-fill": "Draft a complete type-specific husbandry guide for review. Return guideSummary, careDifficulty, and a fields object containing exactly the requested registry keys. Attempt every requested key from the supplied species context, use concise practical values, and use null only when evidence is too weak. Do not duplicate static Species metadata fields such as temperature, pH, GH/KH, TDS, salinity, lifespan, adult size, group size, max plant dimensions, light requirement, flow requirement, or bioload; those belong to the Species definition. Include plantCompatibility when it is among the requested registry keys, describing planted-tank suitability, uprooting, grazing, or robust-plant needs. If species metadata is present, make the guideSummary and any related guidance consistent with it. guideSummary should be a keeper-facing one-paragraph synopsis of the species care profile. careDifficulty should be a concise label such as Easy, Moderate, Advanced, Expert, or a short nuanced equivalent. This is a reviewable draft and is never auto-saved.",
  "species-care-summary": "Summarize the species' recorded care needs, missing husbandry information, and review cautions.",
  "care-digest": "Summarize due and overdue care across the collection, ordered by practical urgency."
};

export function buildEddyPrompt(action: EddyAction, context: EddyAquariumContext | EddySpeciesContext | { kind: "page"; page: string; [key: string]: unknown }, input: Record<string, unknown>) {
  return JSON.stringify({
    task: actionInstructions[action],
    responseShape: {
      title: "string",
      summary: "string",
      observations: ["string"],
      recommendations: ["string"],
      assumptions: ["string"],
      basedOn: [{ label: "string", detail: "string" }],
      verdict: "likely fit | caution | not recommended (compatibility only)",
      suggestions: [{
        id: "string optional",
        name: "string",
        title: "string optional",
        detail: "string",
        description: "string optional",
        tags: ["string optional"],
        palette: ["string optional"],
        paletteNotes: "string optional",
        mood: "string optional",
        motif: "string optional",
        compositionNotes: "string optional",
        promptDraft: "string optional",
        generationPrompt: "string optional",
        caution: "string optional",
        cautions: ["string optional"],
        confidenceLabel: "string optional"
      }],
      questions: ["string"],
      guideSummary: "string|null (husbandry-fill only; saved to the guide Summary field)",
      careDifficulty: "string|null (husbandry-fill only; saved to the guide Care difficulty field)",
      fields: { "registry key": "string|null (husbandry-fill only)" }
    },
    safety: [
      "Do not invent measurements, observations, diagnoses, or certainty.",
      "Medication and dosing guidance must say to verify the product label and observe livestock carefully.",
      "Include a short Based on list and name missing information under assumptions."
    ],
    input,
    context
  });
}
