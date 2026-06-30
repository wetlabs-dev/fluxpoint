export const co2Requirements = ["UNKNOWN", "NOT_NEEDED", "RECOMMENDED", "REQUIRED"] as const;
export type Co2Requirement = typeof co2Requirements[number];

export const co2RequirementLabels: Record<Co2Requirement, string> = {
  REQUIRED: "Required",
  RECOMMENDED: "Recommended",
  NOT_NEEDED: "Not needed",
  UNKNOWN: "Unknown"
};

export const co2RequirementDescriptions: Record<Co2Requirement, string> = {
  REQUIRED: "Normally impractical without injected CO2.",
  RECOMMENDED: "Benefits from injected CO2 but can be kept without it in suitable low-tech conditions.",
  NOT_NEEDED: "Typically low-tech tolerant; injected CO2 is optional.",
  UNKNOWN: "Not enough reliable context recorded yet."
};

export function normalizeCo2Requirement(value: unknown): Co2Requirement {
  const normalized = String(value ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (["NO", "NONE", "NOT_REQUIRED", "NOT_REQUIRE", "OPTIONAL", "LOW_TECH", "LOW_TECH_TOLERANT"].includes(normalized)) return "NOT_NEEDED";
  if (["BENEFICIAL", "BENEFITS", "BENEFITS_FROM_CO2", "SUGGESTED"].includes(normalized)) return "RECOMMENDED";
  if (co2Requirements.includes(normalized as Co2Requirement)) return normalized as Co2Requirement;
  return "UNKNOWN";
}

export function co2RequirementToPreference(value: Co2Requirement) {
  if (value === "REQUIRED") return "Required";
  if (value === "RECOMMENDED") return "Recommended";
  if (value === "NOT_NEEDED") return "Not needed";
  return null;
}
