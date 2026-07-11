import { z } from "zod";

export const aquariumCoverPayloadSchema = z.object({
  aquariumId: z.string().min(1),
  selectedConceptId: z.string().max(200).nullable().optional(),
  selectedConceptTitle: z.string().max(240).nullable().optional(),
  selectedConceptDescription: z.string().max(2000).nullable().optional(),
  selectedConceptPrompt: z.string().max(6000).nullable().optional(),
  selectedConceptTags: z.array(z.string().max(80)).max(8).default([]),
  customPrompt: z.string().max(6000).nullable().optional(),
  expectedCoverMediaAssetId: z.string().nullable().optional(),
  setAsCover: z.boolean().default(true)
});

export type AquariumCoverPayload = z.infer<typeof aquariumCoverPayloadSchema>;

export class TerminalAiJobError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.code = code; }
}
