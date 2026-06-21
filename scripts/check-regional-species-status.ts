import assert from "node:assert/strict";
import { buildLocalityLabel, hasRegionalLookupLocality, isConcerningRegionalStatus, isRestrictedRegionalStatus, neverReleaseMessage, regionalStatusWarning } from "../src/domains/species/regional-status";
import { mockSpeciesMagicFill } from "../src/domains/species/species-magic-fill";

assert.equal(hasRegionalLookupLocality({ localityCountry: "GB", localityCity: "Bristol" }), true);
assert.equal(hasRegionalLookupLocality({ localityCountry: "AU" }), false);
assert.equal(buildLocalityLabel({ localityCity: "Ottawa", localityRegion: "Ontario", localityCountry: "CA" }), "Ottawa, Ontario, Canada");
assert.equal(isConcerningRegionalStatus("ESTABLISHED_NON_NATIVE"), true);
assert.equal(isRestrictedRegionalStatus("PROHIBITED"), true);
assert.match(regionalStatusWarning("INVASIVE", "Queensland, Australia"), /invasive/i);
assert.match(neverReleaseMessage, /Never release/);

const missing = mockSpeciesMagicFill({ category: "PLANT", commonName: "Water hyacinth" });
assert.equal(missing.regionalStatus.status, "UNKNOWN");
assert.match(missing.regionalStatus.notes ?? "", /Add collection locality/);

const localized = mockSpeciesMagicFill({ category: "PLANT", commonName: "Water hyacinth", collectionLocality: { localityCity: "Brisbane", localityRegion: "Queensland", localityCountry: "AU", localityPostalCode: null, localityLabel: "Brisbane, Queensland, Australia", regionalLookupEnabled: true } });
assert.equal(localized.regionalStatus.status, "WATCHLIST");
assert.equal(localized.regionalStatus.localityLabel, "Brisbane, Queensland, Australia");

console.log("Regional species-status checks passed.");
