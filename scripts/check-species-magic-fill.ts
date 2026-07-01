import assert from "node:assert/strict";
import { mockSpeciesMagicFill, speciesMagicFillDraftSchema, speciesMagicFillInstructions } from "../src/domains/species/species-magic-fill";
import { verifyReferenceUrl } from "../src/domains/species/reference-resolution";
import { resolveSpeciesReferences } from "../src/domains/species/species-reference-resolver";
import { normalizeSpeciesAlias } from "../src/domains/species/aliases";
import { buildScientificNameWithAuthor, formatAuthorCitation, normalizeAuthorCitation } from "../src/lib/format/species";

const corrected = mockSpeciesMagicFill({ category: "FISH", commonName: "Masked Julie", genus: "julidochromis", species: "marlieri" });
assert.equal(corrected.canonical.genus, "Julidochromis");
assert.equal(corrected.canonical.species, "transcriptus");
assert.equal(corrected.confidence, "MEDIUM");
assert.ok(corrected.warnings.some((warning) => warning.includes("marlieri")));
assert.equal(corrected.aliases[0]?.alias, "Masked Julii");
assert.equal(corrected.salinityMinPpt, 0);
assert.equal(corrected.salinityMaxPpt, 0.5);
assert.deepEqual(corrected.references, { authorCitation: null, wikipediaUrl: null, inaturalistUrl: null, powoUrl: null, gbifUrl: null });
assert.equal(corrected.bioloadClass, "MODERATE");
assert.doesNotThrow(() => speciesMagicFillDraftSchema.parse(corrected));

const conservative = mockSpeciesMagicFill({ category: "PLANT", commonName: "Mystery stem", genus: "rotala", species: "" });
assert.equal(conservative.confidence, "LOW");
assert.equal(conservative.canonical.genus, "Rotala");
assert.equal(conservative.canonical.species, "sp.");
assert.ok(conservative.warnings.some((warning) => warning.includes("Only genus could be resolved")));
assert.equal(conservative.profile.tempMin, null);
assert.equal(conservative.salinityMinPpt, null);
assert.equal(normalizeSpeciesAlias("  Masked   JULII  "), "masked julii");

const javaFern = mockSpeciesMagicFill({ category: "PLANT", commonName: "Java fern" });
assert.equal(javaFern.canonical.category, "PLANT");
assert.equal(javaFern.canonical.commonName, "Java Fern");
assert.equal(javaFern.canonical.genus, "Microsorum");
assert.equal(javaFern.references.authorCitation, "(Blume) Copel.");
assert.equal(formatAuthorCitation(javaFern.references.authorCitation), "(Blume) Copel.");
assert.equal(javaFern.references.gbifUrl, "https://www.gbif.org/species/7289955");
assert.equal(javaFern.bioloadClass, null);
assert.equal(javaFern.aliases[0]?.alias, "Leptochilus pteropus");
assert.equal(javaFern.aliases[0]?.source, "GBIF Backbone Taxonomy");
assert.equal(javaFern.profile.co2Requirement, "NOT_NEEDED");
assert.equal(javaFern.profile.growthRate, "Slow");
assert.equal(javaFern.profile.tdsMin, 80);
assert.equal(javaFern.profile.tdsMax, 250);
assert.equal(javaFern.salinityMinPpt, 0);
assert.equal(javaFern.variantSuggestion, null);
assert.ok(javaFern.profile.tempMin != null);

const categoryCorrection = mockSpeciesMagicFill({ category: "FISH", commonName: "Java fern" });
assert.equal(categoryCorrection.canonical.category, "PLANT");
assert.ok(categoryCorrection.warnings.some((warning) => warning.includes("selected category is fish")));

const zebraObliquidens = mockSpeciesMagicFill({ category: "FISH", commonName: "Zebra obliquidens" });
assert.equal(zebraObliquidens.canonical.genus, "Astatotilapia");
assert.equal(zebraObliquidens.references.authorCitation, "Regan, 1929");
assert.equal(normalizeAuthorCitation("(Regan, 1929)"), "Regan, 1929");
assert.equal(formatAuthorCitation(zebraObliquidens.references.authorCitation), "(Regan, 1929)");
assert.equal(buildScientificNameWithAuthor({ genus: "Astatotilapia", species: "latifasciata", authorCitation: "(Regan, 1929)" }), "Astatotilapia latifasciata (Regan, 1929)");
assert.equal(zebraObliquidens.references.gbifUrl, "https://www.gbif.org/species/2373362");
assert.equal(zebraObliquidens.bioloadClass, "MODERATE");
assert.equal(zebraObliquidens.references.powoUrl, null);
assert.equal(zebraObliquidens.aliases[0]?.alias, "Haplochromis latifasciatus");
assert.equal(zebraObliquidens.salinityMinPpt, 0);
assert.equal(zebraObliquidens.profile.maxSize, "4–5 in");
assert.equal(zebraObliquidens.profile.tdsMin, 180);
assert.equal(zebraObliquidens.profile.tdsMax, 450);
assert.equal(zebraObliquidens.profile.co2Requirement, "UNKNOWN");
assert.ok(zebraObliquidens.profile.tempMin != null);
assert.ok(zebraObliquidens.profile.breedingNotes);
assert.doesNotThrow(() => speciesMagicFillDraftSchema.parse(zebraObliquidens));

const orangeRili = mockSpeciesMagicFill({ category: "INVERT", commonName: "Orange Rili shrimp" });
assert.equal(orangeRili.canonical.genus, "Neocaridina");
assert.equal(orangeRili.canonical.species, "davidi");
assert.equal(orangeRili.variantSuggestion?.name, "Orange Rili shrimp");
assert.equal(orangeRili.variantSuggestion?.variantType, "COLOR_MORPH");
assert.ok(orangeRili.warnings.some((warning) => warning.includes("not a separate species")));

for (const field of ["authorCitation", "wikipediaUrl", "inaturalistUrl", "powoUrl", "gbifUrl", "maxSize", "bioloadClass", "co2Requirement", "variantSuggestion", "salinityMinPpt", "salinityMaxPpt", "tdsMin", "tdsMax", "preferredHardness", "flowRequirement", "breedingNotes", "regionalStatus"]) {
  assert.ok(speciesMagicFillInstructions.includes(field), `Magic Fill instructions should explicitly request ${field}`);
}
assert.ok(speciesMagicFillInstructions.includes("complete species definition"));
assert.ok(speciesMagicFillInstructions.includes("Continue through all field groups"));
assert.ok(speciesMagicFillInstructions.includes("powoUrl only for PLANT"));
const preservedReference = mockSpeciesMagicFill({ category: "PLANT", commonName: "Mystery stem", wikipediaUrl: "https://example.org/taxon" });
assert.equal(preservedReference.references.wikipediaUrl, "https://example.org/taxon");
const rejectedReference = mockSpeciesMagicFill({ category: "PLANT", commonName: "Mystery stem", wikipediaUrl: "not-a-url" });
assert.equal(rejectedReference.references.wikipediaUrl, null);
const nonPlantPowo = mockSpeciesMagicFill({ category: "FISH", commonName: "Mystery fish", powoUrl: "https://powo.science.kew.org/taxon/example" });
assert.equal(nonPlantPowo.references.powoUrl, null);
for (const category of ["INVERT", "CORAL", "OTHER"] as const) {
  const draft = mockSpeciesMagicFill({ category, commonName: `Test ${category.toLowerCase()}` });
  assert.equal(draft.canonical.category, category);
}

async function main() {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.hostname === "en.wikipedia.org") {
      const title = url.searchParams.get("titles");
      if (title === "Astatotilapia latifasciata") return jsonResponse({ query: { pages: { 1: { title, extract: "Astatotilapia latifasciata is a cichlid fish.", pageprops: { wikibase_item: "QFish" }, revisions: [{ slots: { main: { "*": "{{Speciesbox| taxon = Astatotilapia latifasciata | authority = (Regan, 1929)}}\n| species = latifasciata" } } }] } } } });
      if (title === "Davallia fejeensis") return jsonResponse({ query: { pages: { 2: { title, extract: "Davallia fejeensis is a fern plant.", pageprops: { wikibase_item: "QPlant" }, revisions: [{ slots: { main: { "*": "{{Speciesbox| taxon = Davallia fejeensis | authority = Hook.}}\n| species = fejeensis" } } }] } } } });
    }
    if (url.hostname === "www.wikidata.org" && url.pathname.includes("QFish")) return jsonResponse({ entities: { QFish: { claims: { P3151: [claim("102186")] } } } });
    if (url.hostname === "www.wikidata.org" && url.pathname.includes("QPlant")) return jsonResponse({ entities: { QPlant: { claims: { P3151: [claim("203565")], P5037: [claim("urn:lsid:ipni.org:names:17077090-1")] } } } });
    if (url.hostname === "api.gbif.org") {
      const name = url.searchParams.get("name");
      if (url.pathname === "/v1/species/999") return jsonResponse({ canonicalName: "Unrelated moth", kingdom: "Animalia", class: "Insecta", taxonomicStatus: "ACCEPTED" });
      if (name === "Astatotilapia latifasciata") return jsonResponse({ usageKey: 2373360, confidence: 99, canonicalName: name, authorship: "(Regan, 1929)", kingdom: "Animalia", phylum: "Chordata", class: "Actinopterygii" });
      if (name === "Davallia fejeensis") return jsonResponse({ usageKey: 2651070, confidence: 99, canonicalName: name, authorship: "Hook.", kingdom: "Plantae", phylum: "Tracheophyta", class: "Polypodiopsida" });
    }
    if (url.hostname === "api.inaturalist.org") {
      if (url.pathname === "/v1/taxa/404") return jsonResponse({}, 404);
      const q = url.searchParams.get("q");
      if (q === "Astatotilapia latifasciata") return jsonResponse({ results: [{ id: 102186, name: q, iconic_taxon_name: "Actinopterygii" }] });
      if (q === "Davallia fejeensis") return jsonResponse({ results: [{ id: 203565, name: q, iconic_taxon_name: "Plantae" }] });
    }
    return jsonResponse({}, 404);
  };

  const resolvedFish = await resolveSpeciesReferences({ ...zebraObliquidens, references: { authorCitation: null, wikipediaUrl: null, inaturalistUrl: null, powoUrl: null, gbifUrl: null } });
  assert.equal(resolvedFish.references.authorCitation, "Regan, 1929");
  assert.equal(resolvedFish.references.wikipediaUrl, "https://en.wikipedia.org/wiki/Astatotilapia_latifasciata");
  assert.equal(resolvedFish.references.inaturalistUrl, "https://www.inaturalist.org/taxa/102186");
  assert.equal(resolvedFish.references.gbifUrl, "https://www.gbif.org/species/2373360");
  assert.equal(resolvedFish.references.powoUrl, null);

  const resolvedPlant = await resolveSpeciesReferences({
    ...javaFern,
    confidence: "HIGH",
    canonical: { ...javaFern.canonical, commonName: "Davallia", genus: "Davallia", species: "fejeensis", scientificDisplayName: "Davallia fejeensis" },
    references: { authorCitation: null, wikipediaUrl: null, inaturalistUrl: null, powoUrl: null, gbifUrl: null }
  });
  assert.equal(resolvedPlant.references.authorCitation, "Hook.");
  assert.equal(resolvedPlant.references.wikipediaUrl, "https://en.wikipedia.org/wiki/Davallia_fejeensis");
  assert.equal(resolvedPlant.references.inaturalistUrl, "https://www.inaturalist.org/taxa/203565");
  assert.equal(resolvedPlant.references.gbifUrl, "https://www.gbif.org/species/2651070");
  assert.equal(resolvedPlant.references.powoUrl, "https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:17077090-1");
  assert.equal((await verifyReferenceUrl("inaturalist", "https://www.inaturalist.org/taxa/404", "Astatotilapia latifasciata", "FISH")).ok, false);
  assert.equal((await verifyReferenceUrl("gbif", "https://www.gbif.org/species/999", "Astatotilapia latifasciata", "FISH")).ok, false);
  globalThis.fetch = originalFetch;
}

function claim(value: string) {
  return { mainsnak: { datavalue: { value } } };
}

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}

main().then(() => console.log("Species Magic Fill checks passed."));
