# Image Moderation

Fluxpoint image moderation is asynchronous and fail-closed. Upload requests store the original file, thumbnail, and `MediaAsset` row immediately with `moderationStatus=PENDING`; the browser is never held open while OpenAI analyzes the image.

The `image-moderation` worker then runs two layers:

1. Safety moderation with `OPENAI_IMAGE_MODERATION_MODEL` (fallback `OPENAI_MODERATION_MODEL`, then `omni-moderation-latest`).
   - Unsafe images become `CENSORED`, set `nsfwFlagged=true`, clear any cover-image reference, and create a pending `ImageModerationReview` of type `NSFW`.
   - Censored, removed, rejected, flagged, or hidden images are blocked by the protected media route even for direct URLs.
2. Aquarium relevance review with `OPENAI_AQUARIUM_IMAGE_CHECK_MODEL` (fallback `OPENAI_DEFAULT_RESPONSES_MODEL`, then `OPENAI_DEFAULT_CHAT_MODEL`).
   - Clear aquarium content becomes `APPROVED`.
   - Clear non-aquarium content becomes `NO_AQUARIUM_CONTENT`.
   - Ambiguous content becomes `UNCERTAIN_AQUARIUM_CONTENT`.
   - Non-aquarium and uncertain results create uploader-facing `ImageModerationReview` records so the uploader can keep the photo as a false negative or remove it.

`MediaAsset` stores the machine-readable evidence:

- `moderationResultJson` for safety categories/scores.
- `aquariumAnalysisJson` for aquarium relevance decision, confidence, reason, and suggested caption.
- `aquariumContentDetected` and `aquariumContentConfidence` for quick filtering/reporting.
- `moderationFailureCount` for retry tracking.

Failures remain `PENDING` until the retry limit. After three failed moderation attempts, Fluxpoint marks the asset `MODERATION_FAILED`, keeps it out of normal display, and records the failure on the generic `ModerationReview`.

## Human review

Uploader reviews appear on Account Settings for `NO_AQUARIUM_CONTENT` and `UNCERTAIN_AQUARIUM_CONTENT`. The uploader can:

- keep the photo, which marks the review `USER_CONFIRMED` and approves the asset;
- remove the photo, which marks the asset `REMOVED`.

Server-admin safety reviews appear in Server Maintenance. Admins can:

- mark the safety result as a false positive, which approves the photo and clears `nsfwFlagged`;
- remove the photo;
- optionally disable the uploader when removing a safety-flagged upload.

## Configuration

Required for production moderation:

```env
OPENAI_API_KEY=...
FLUXPOINT_IMAGE_MODERATION_ENABLED=true
IMAGE_MODERATION_PROVIDER=openai
OPENAI_IMAGE_MODERATION_MODEL=omni-moderation-latest
OPENAI_AQUARIUM_IMAGE_CHECK_MODEL=gpt-4.1-mini
ENABLE_IMAGE_MODERATION_WORKER=true
```

Optional worker controls:

```env
FLUXPOINT_IMAGE_MODERATION_WORKER_INTERVAL_SECONDS=180
FLUXPOINT_IMAGE_MODERATION_BATCH_SIZE=10
```

Legacy `IMAGE_MODERATION_*` names still work as fallbacks. `IMAGE_MODERATION_DEV_BYPASS=true` only applies outside production and should never be enabled in production.

Start the worker with the existing workers profile:

```bash
docker compose --profile workers up -d image-moderation
```

Normal public/gallery display requires `moderationStatus=APPROVED`, no `hiddenAt`, no safety flag, and the usual collection/public visibility permissions.
