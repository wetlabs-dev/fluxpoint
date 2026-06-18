export function buildScientificDisplayName(definition: {
  scientificName?: string | null;
  genus?: string | null;
  species?: string | null;
  variety?: string | null;
  cultivar?: string | null;
}) {
  const base = [definition.genus, definition.species].filter(Boolean).join(" ");
  const variety = definition.variety ? `var. ${definition.variety}` : "";
  const cultivar = definition.cultivar ? `'${definition.cultivar}'` : "";
  return [base || definition.scientificName, variety, cultivar].filter(Boolean).join(" ") || "Scientific name not set";
}
