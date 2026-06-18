import { z } from "zod";

const optionalText = z.string().trim().optional();
const optionalNumber = z.preprocess((value) => value === "" ? undefined : value, z.coerce.number().positive().optional());

export const aquariumFormSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Name must be at least 2 characters."),
  generatedName: optionalText,
  description: optionalText,
  tankType: z.enum(["FRESHWATER", "BRACKISH", "SALTWATER", "POND", "QUARANTINE", "GROWOUT", "OTHER"]),
  volumeGallons: optionalNumber,
  lengthInches: optionalNumber,
  widthInches: optionalNumber,
  heightInches: optionalNumber,
  locationId: optionalText,
  status: z.enum(["ACTIVE", "PLANNING", "ARCHIVED"]),
  startedAt: z.preprocess((value) => value === "" ? undefined : value, z.coerce.date().optional()),
  notes: optionalText,
  substrateItemId: optionalText,
  lightItemId: optionalText,
  heaterItemId: optionalText,
  filtration: optionalText,
  heating: optionalText,
  waterSource: optionalText,
  targetTemperature: optionalNumber,
  targetPh: optionalNumber,
  targetGh: optionalNumber,
  targetKh: optionalNumber,
});

export type AquariumFormInput = z.infer<typeof aquariumFormSchema>;
