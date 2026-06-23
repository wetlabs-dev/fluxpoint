# Species Magic Fill

Species Magic Fill is an Eddy-assisted draft tool on create and edit species forms. It uses the keeper's current identity fields as context and proposes canonical taxonomy, supported Fluxpoint care fields, alternate names, and a collection-specific regional status when sufficient locality is configured.

The selected species category is controlled form state and is sent explicitly with every request. Category navigation, the visible category label, type-specific fields, submitted category, and Magic Fill review therefore remain synchronized. Provider output is validated back to the keeper-selected category rather than silently falling back to fish.

The workflow is deliberately review-first:

1. Enter as much of the common or scientific name as is known.
2. Select **Magic Fill**.
3. Review Eddy's confidence, summary, warnings, identity proposal, reference metadata, salinity range, profile fields, and aliases.
4. Apply or discard the draft.
5. Edit any applied values and submit the normal species form when ready.

Applying only changes browser form values. It does not create or update a species. A successful application is linked to its AI request log when the keeper later saves, providing an audit trail without treating AI output as verified fact.

The strict draft contract always includes `salinityMinPpt`, `salinityMaxPpt`, an aliases array, and nullable reference metadata for author citation, Wikipedia, iNaturalist, POWO, and GBIF. Eddy may suggest a reference only when it is confident the direct URL identifies the exact taxon; uncertain URLs remain null. Applying a draft updates reference inputs, salinity controls, and derived freshwater/brackish/marine badges immediately. Suggested alternate common names, trade names, spelling variants, old names, and scientific synonyms merge into the existing alias rows using normalized deduplication; Eddy leaves uncertain aliases out. Existing aliases remain in place.

Regional status is never treated as a universal species property or guaranteed legal conclusion. Eddy uses the collection country and locality, returns **Unknown** when context or evidence is insufficient, and prompts the keeper to verify invasive, restricted, or prohibited drafts with the relevant local authority. Without country plus a city, region, or postal code, taxonomy and care drafting still work while regional checking remains unavailable.

The tool uses Fluxpoint's normal authentication, collection authorization, provider configuration, AI request logging, and rate-limit controls. `EDDY_SPECIES_MAGIC_FILL_DAILY_USER_LIMIT` overrides its default personal daily limit. With the mock provider, Eddy offers conservative normalization and a deterministic example for supported fixture data; unknown husbandry values remain blank.

When OpenAI is configured, the server uses the Responses API with a strict structured-output schema. The private API key remains server-only. Responses still pass through application validation, salinity range normalization, and alias deduplication before reaching the review panel. The Magic Fill card uses Fluxpoint’s bundled Eddy asset, so no remote image is required in standalone Docker builds.

To extend Magic Fill later, add a durable field to the Prisma species model and migration, expose it on the species form and action, then add the matching nullable property to the input schema, draft schema, strict provider JSON schema, review mapping, mock fixture, and integrity check. Regional fields belong in the collection-scoped status model rather than on the global species definition. Keeping those layers together prevents the AI contract from drifting away from what Fluxpoint can actually save.
