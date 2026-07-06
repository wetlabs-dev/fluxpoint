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

export function normalizeAuthorCitation(value: string | null | undefined) {
  const trimmed = (value ?? "").trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  if (shouldStripCitationWrapper(trimmed)) {
    return trimmed.slice(1, -1).trim().replace(/\s+/g, " ") || null;
  }
  return trimmed;
}

export function formatAuthorCitation(value: string | null | undefined) {
  const normalized = normalizeAuthorCitation(value);
  if (!normalized) return "";
  return normalized.startsWith("(") ? normalized : `(${normalized})`;
}

export function buildScientificNameWithAuthor(definition: Parameters<typeof buildScientificDisplayName>[0] & { authorCitation?: string | null }) {
  return [buildScientificDisplayName(definition), formatAuthorCitation(definition.authorCitation)].filter(Boolean).join(" ");
}

function balancedOuterParentheses(value: string) {
  let depth = 0;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (depth === 0 && index < value.length - 1) return false;
    if (depth < 0) return false;
  }
  return depth === 0;
}

function shouldStripCitationWrapper(value: string) {
  if (!value.startsWith("(") || !value.endsWith(")") || !balancedOuterParentheses(value)) return false;
  const inner = value.slice(1, -1).trim();
  if (!inner || /[()]/.test(inner)) return false;
  return /\b\d{4}\b/.test(inner) || inner.includes(",");
}
