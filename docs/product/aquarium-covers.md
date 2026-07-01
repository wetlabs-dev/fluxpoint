# Aquarium Covers

Aquarium detail pages render a cover/header area at the top of the workspace overview. If an approved cover media asset exists, the header uses that image with a strong overlay so the aquarium name and caption remain readable in light and dark mode. If no approved cover exists, Fluxpoint renders a high-contrast aquatic gradient placeholder with helper text.

## Sources

Aquarium covers can come from:

- an approved uploaded photo selected as the aquarium cover;
- an Eddy-generated cover image;
- the default placeholder when no approved cover is available.

Generated Eddy covers are not a separate storage system. The image workflow writes the file to the existing uploads area, creates a `MediaAsset`, moderates it, and assigns the approved asset to the aquarium through the normal cover fields.

## Eddy cover workflow

1. The keeper opens Eddy Studio on an aquarium page.
2. Eddy can create structured cover concepts with title, description, tags, palette notes, composition notes, cautions, and a generation prompt.
3. The keeper selects a concept or enters a custom prompt override.
4. The server checks auth, collection access, feature availability, rate limits, prompt moderation, and provider configuration.
5. In OpenAI mode, Fluxpoint calls the OpenAI Images API (`/v1/images/generations`) for the final image. Responses/Chat may be used for text concept drafting, but never for creating the cover image itself. In mock mode, Fluxpoint creates a local placeholder PNG for testability.
6. The generated file is saved under `/public/uploads/ai`.
7. Fluxpoint moderates the generated image.
8. If approved, Fluxpoint creates a `MediaAsset`, updates the aquarium cover reference, logs the AI request/audit events, revalidates the aquarium page, and returns success.

If moderation blocks the prompt or image, or if the provider/storage step fails, the aquarium cover is not changed and the UI shows an actionable error.

## Configuration

For production OpenAI image generation:

- `AI_ENABLED` must not be `false`.
- `AI_PROVIDER=openai`.
- `OPENAI_API_KEY` must be set server-side.
- `AI_IMAGE_ENABLED` must not be `false`.
- `OPENAI_IMAGE_MODEL` may be set; if omitted, Fluxpoint uses its default image model.
- `AI_MODERATION_ENABLED` must not be `false` for the cover-image feature.
- Eddy image limits can be tuned with `EDDY_IMAGE_DAILY_USER_LIMIT` and `EDDY_IMAGE_DAILY_COLLECTION_LIMIT`.

The public UI never exposes the private API key. It may show that the provider is disabled, missing configuration, rate limited, or blocked by moderation.

## Troubleshooting

- If the button is hidden, confirm image generation is enabled and the current provider supports the image workflow.
- If OpenAI dashboard shows no Images API call, check preflight failures first: auth, collection role, `AI_PROVIDER`, `OPENAI_API_KEY`, `AI_IMAGE_ENABLED`, moderation, and Eddy rate limits. Successful image requests log `providerCallType: IMAGE`.
- If an image is generated but not visible, confirm a `MediaAsset` was created with `APPROVED` moderation status and the aquarium `coverMediaAssetId` points to it.
- If local testing should not call OpenAI, use `AI_PROVIDER=mock`; mock mode still writes a generated PNG and exercises the media assignment path.
