# AI Provider Behavior

Fluxpoint AI features use focused server-side workflows rather than exposing provider keys to the browser. Text tools use the configured text provider/model, while image creation uses a dedicated image path.

## Text tools

Species Magic Fill, Husbandry Magic Fill, Eddy summaries, compatibility, care advice, and parameter advice use structured JSON contracts. Server validation decides what can be shown or applied. If an AI draft contains a field that Fluxpoint does not save, the server normalizes it away instead of silently storing unsupported data.

Species Magic Fill verifies reference URLs after the provider response. Wikipedia, iNaturalist, GBIF, and plant-only POWO links must match a direct source page, expected accepted taxon or clear synonym, and plausible organism group. Wrong-taxon, 404, search-result, or unverifiable URLs are left blank.

## Image tools

Aquarium cover generation calls the OpenAI Images API directly in OpenAI mode. Responses or Chat Completions may draft cover concepts or prompt text, but the final cover image call uses `/v1/images/generations` with `OPENAI_IMAGE_MODEL` or the default image model fallback.

Successful image requests are logged with `requestType: IMAGE_GENERATION`, `providerCallType: IMAGE`, the image model, and normal Eddy rate-limit/audit records. Mock mode creates a local placeholder PNG and marks the result as `providerCallType: MOCK`.

## Configuration

- `AI_PROVIDER=openai` enables OpenAI when `OPENAI_API_KEY` is present.
- `OPENAI_DEFAULT_RESPONSES_MODEL` / `OPENAI_DEFAULT_CHAT_MODEL` configure text tools.
- `OPENAI_IMAGE_MODEL` configures cover image generation; if omitted, Fluxpoint uses its default image model.
- `AI_IMAGE_ENABLED=false` disables image generation without disabling text tools.
- Private provider keys remain server-only.
