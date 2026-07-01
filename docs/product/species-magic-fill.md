# Species Magic Fill

Species Magic Fill is an Eddy-assisted complete-profile drafting tool on create and edit species forms. It uses the keeper's current fields as context and attempts every supported part of the definition in one pass: accepted taxonomy and author citation, direct reference links, alternate names, salinity and habitat inputs, care ranges, husbandry metadata, and collection-specific regional status when sufficient locality is configured. Unsupported or uncertain values remain null rather than being invented.

The selected species category is controlled form state and is sent explicitly with every request. When it conflicts with a recognizable organism, Eddy may propose the likely correct category and must explain the mismatch in a warning. Nothing changes immediately: only the keeper's explicit **Apply draft to form** action updates the category, visible type-specific fields, and submitted value for further review.

The workflow is deliberately review-first:

1. Enter as much of the common or scientific name as is known.
2. Select **Magic Fill**.
3. Review Eddy's confidence, summary, warnings, identity proposal, reference metadata, salinity range, profile fields, and aliases.
4. Apply or discard the draft.
5. Edit any applied values and submit the normal species form when ready.

Applying only changes browser form values. It does not create or update a species. A successful application is linked to its AI request log when the keeper later saves, providing an audit trail without treating AI output as verified fact.

The strict draft contract includes every field group the form can save. Identity covers category, common and scientific components, normalized display name, and author citation. If Eddy can resolve only a genus, the species epithet is explicitly set to `sp.` and a warning explains that the exact species was not resolved. References cover Wikipedia, iNaturalist, GBIF, and plant-only POWO. Eddy prefers direct accepted taxon pages; search-result URLs are fallback values only and must be called out in warnings. Non-plant drafts return no POWO URL. The profile covers category-relevant dimensions, fish maximum size, plant CO₂ requirement, life history, aquarium care ranges, hardness, flow, breeding, salinity, and notes. Eddy may suggest a reference only when it is confident the URL identifies the intended taxon; uncertain URLs remain null. Applying a draft updates reference inputs, salinity controls, plant CO₂ controls, and derived freshwater/brackish/marine badges immediately.

After the provider returns a draft, Fluxpoint runs a best-effort canonical reference resolver for medium- and high-confidence species-level identities. The resolver treats Wikipedia as a hub, using the accepted article and Wikidata taxon identifiers when available, then asks GBIF and iNaturalist directly; plant drafts also accept POWO identifiers from Wikidata. This pass can fill or upgrade missing/search-only reference URLs and author citation before the review panel is shown. It fails soft when an external source is unavailable, so Magic Fill still returns the original draft rather than blocking the keeper.

Plant CO₂ output is structured as `REQUIRED`, `RECOMMENDED`, `NOT_NEEDED`, or `UNKNOWN`. Required means a plant is normally unsuitable without supplemental CO₂; recommended means CO₂ improves growth or stability but is not mandatory; not needed means the plant is generally low-tech compatible. Non-plant drafts always return `UNKNOWN`.

Aliases are an explicit completion step rather than incidental prose. Eddy checks scientific synonyms, old taxonomy, alternate spellings, trade and hobby names, and common-name variants, returning the existing structured alias type plus optional notes and source. Suggested aliases merge into existing rows using normalized deduplication; uncertain aliases stay out and existing aliases remain in place.

Regional status is never treated as a universal species property or guaranteed legal conclusion. Eddy uses the collection country and locality, returns **Unknown** when context or evidence is insufficient, and prompts the keeper to verify invasive, restricted, or prohibited drafts with the relevant local authority. Without country plus a city, region, or postal code, taxonomy and care drafting still work while regional checking remains unavailable.

The tool uses Fluxpoint's normal authentication, collection authorization, provider configuration, AI request logging, and rate-limit controls. `EDDY_SPECIES_MAGIC_FILL_DAILY_USER_LIMIT` overrides its default personal daily limit. With the mock provider, Eddy offers conservative normalization and a deterministic example for supported fixture data; unknown husbandry values remain blank.

When OpenAI is configured, the server uses the Responses API with a strict structured-output schema and enough output budget for a complete profile. The prompt explicitly walks through identity, author citation, aliases, salinity, every supported care field, four reference providers, and regional context. The private API key remains server-only. Responses still pass through application validation, salinity range normalization, category-mismatch warnings, and alias deduplication before reaching the review panel. The Magic Fill card uses Fluxpoint’s bundled Eddy asset, so no remote image is required in standalone Docker builds.

To extend Magic Fill later, add a durable field to the Prisma species model and migration, expose it on the species form and action, then add the matching nullable property to the input schema, draft schema, strict provider JSON schema, review mapping, mock fixture, and integrity check. Regional fields belong in the collection-scoped status model rather than on the global species definition. Keeping those layers together prevents the AI contract from drifting away from what Fluxpoint can actually save.
