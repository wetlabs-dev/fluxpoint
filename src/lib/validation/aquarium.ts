import { z } from "zod";

const optionalText = z.string().trim().optional();
const optionalNumber = z.preprocess((value) => value === "" ? undefined : value, z.coerce.number().positive().optional());
const optionalNonNegativeNumber = z.preprocess((value) => value === "" ? undefined : value, z.coerce.number().finite().min(0).optional());

export const aquariumFormSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Name must be at least 2 characters."),
  description: optionalText,
  targetSalinityMinPpt: optionalNonNegativeNumber,
  targetSalinityMaxPpt: optionalNonNegativeNumber,
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
  targetTemperature: optionalNonNegativeNumber,
  targetPh: optionalNonNegativeNumber,
  targetGh: optionalNonNegativeNumber,
  targetKh: optionalNonNegativeNumber,
}).superRefine((value, context) => {
  if (value.targetSalinityMinPpt != null && value.targetSalinityMaxPpt != null && value.targetSalinityMinPpt > value.targetSalinityMaxPpt) context.addIssue({ code: "custom", path: ["targetSalinityMaxPpt"], message: "Maximum salinity must be greater than or equal to minimum salinity." });
});

export type AquariumFormInput = z.infer<typeof aquariumFormSchema>;
