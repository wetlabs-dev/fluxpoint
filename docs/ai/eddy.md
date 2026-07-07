# Eddy

Eddy is Fluxpoint's built-in structured aquarium assistant. Earlier scaffolding referred to this feature as Current Keeper; Eddy is the canonical name going forward. Eddy is tool-based and does not provide an open-ended chat surface.

Eddy helps with aquarium care, husbandry, tank identity, schedules, troubleshooting, and interpreting aquarium records. Eddy should sound calm, practical, observant, and careful. Eddy should not overstate certainty, invent missing parameters or observations, or treat medication advice as a substitute for product labels and careful verification.

The feature lives under `src/domains/eddy`: context builders authorize and assemble aquarium or species records, prompts define the structured and safety-aware response contract, and the service selects mock or OpenAI behavior while recording every request. Authenticated endpoints are exposed through `/api/eddy/[action]`; API keys remain server-side.

The mock provider is the development-safe default. `AI_ENABLED`, `AI_PROVIDER`, `AI_IMAGE_ENABLED`, `AI_MODERATION_ENABLED`, and `AI_RATE_LIMITS_ENABLED` control the provider and quota status shown in Server Maintenance. OpenAI requests use `OPENAI_API_KEY` and the configured response, cover-image, and moderation models. Cover generation uses the OpenAI Images API with `OPENAI_COVER_IMAGE_MODEL`, `OPENAI_COVER_IMAGE_SIZE`, and `OPENAI_COVER_IMAGE_QUALITY`. See [`rate-limits.md`](rate-limits.md) for durable usage accounting.
