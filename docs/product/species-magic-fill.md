# Species Magic Fill

Species Magic Fill is an Eddy-assisted draft tool on create and edit species forms. It uses the keeper's current identity fields as context and proposes canonical taxonomy, supported Fluxpoint care fields, and alternate names.

The workflow is deliberately review-first:

1. Enter as much of the common or scientific name as is known.
2. Select **Magic Fill**.
3. Review Eddy's confidence, summary, warnings, identity proposal, profile fields, and aliases.
4. Apply or discard the draft.
5. Edit any applied values and submit the normal species form when ready.

Applying only changes browser form values. It does not create or update a species. A successful application is linked to its AI request log when the keeper later saves, providing an audit trail without treating AI output as verified fact.

The tool uses Fluxpoint's normal authentication, collection authorization, provider configuration, AI request logging, and rate-limit controls. `EDDY_SPECIES_MAGIC_FILL_DAILY_USER_LIMIT` overrides its default personal daily limit. With the mock provider, Eddy offers conservative normalization and a deterministic example for supported fixture data; unknown husbandry values remain blank.

When OpenAI is configured, the server uses the Responses API with a strict structured-output schema. The private API key remains server-only. Responses still pass through application validation, range normalization, and alias deduplication before reaching the review panel.

To extend Magic Fill later, add a durable field to the Prisma species model and migration, expose it on the species form and action, then add the matching nullable property to the input schema, draft schema, strict provider JSON schema, review mapping, mock fixture, and integrity check. Keeping those layers together prevents the AI contract from drifting away from what Fluxpoint can actually save.
