import { z } from "zod";

export const aquariumFormSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Name must be at least 2 characters."),
  generatedName: z.string().trim().optional(),
  description: z.string().trim().optional(),
  tankType: z.enum(["FRESHWATER", "BRACKISH", "SALTWATER", "POND", "QUARANTINE", "GROWOUT", "OTHER"]),
  volumeGallons: z.coerce.number().positive().optional(),
  lengthInches: z.coerce.number().positive().optional(),
  widthInches: z.coerce.number().positive().optional(),
  heightInches: z.coerce.number().positive().optional(),
  location: z.string().trim().optional(),
  status: z.enum(["ACTIVE", "PLANNING", "ARCHIVED"]),
  notes: z.string().trim().optional()
});

export type AquariumFormInput = z.infer<typeof aquariumFormSchema>;
