import { z } from "zod";

const optionalText = z.string().trim().optional();
const optionalNumber = z.preprocess((value) => value === "" ? undefined : value, z.coerce.number().positive().optional());

export const aquariumFormSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Name must be at least 2 characters."),
  generatedName: optionalText,
  description: optionalText,
  salinity: z.enum(["FRESHWATER", "BRACKISH", "MARINE"]),
  aquariumType: z.enum(["DISPLAY", "QUARANTINE", "HOSPITAL", "POND", "BREEDING", "GROW_OUT", "FRAG", "HOLDING", "OTHER"]),
  volumeGallons: optionalNumber,
  volumeUnit: z.enum(["GALLON", "LITER"]).default("GALLON"),
  lengthInches: optionalNumber,
  widthInches: optionalNumber,
  heightInches: optionalNumber,
  locationId: optionalText,
  status: z.enum(["ACTIVE", "PLANNING", "ARCHIVED"]),
  startedAt: z.preprocess((value) => value === "" ? undefined : value, z.coerce.date().optional()),
  notes: optionalText,
  waterSource: optionalText,
  targetTemperature: optionalNumber,
  targetPh: optionalNumber,
  targetGh: optionalNumber,
  targetKh: optionalNumber,
});

export type AquariumFormInput = z.infer<typeof aquariumFormSchema>;
