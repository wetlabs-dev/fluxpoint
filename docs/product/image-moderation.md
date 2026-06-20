# Image Moderation

Image moderation is asynchronous and fail-closed. The upload request returns after durable storage with `MediaAsset.moderationStatus=PENDING`; pending, flagged, rejected, errored, or hidden assets never render their image bytes in normal gallery, cover, card, or timeline components.

The `image-moderation` worker scans pending assets with fewer than three attempts. With `AI_PROVIDER=openai`, `OPENAI_API_KEY` configured, and `IMAGE_MODERATION_PROVIDER=openai`, it sends the image as a data URL to the OpenAI Moderation API. Safe results become `APPROVED`; flagged results become `REJECTED`; failures remain pending until the retry limit, then become `ERROR`. The generic `ModerationReview` and `AuditLog` records retain the decision trail.

`IMAGE_MODERATION_ENABLED=false` makes the worker a safe no-op and does not approve files. `IMAGE_MODERATION_DEV_BYPASS=true` approves only when `NODE_ENV` is not production, and must be set explicitly. Production never uses the bypass. Start the worker through the existing Docker workers profile after setting `ENABLE_IMAGE_MODERATION_WORKER=true`.

Public display requires `visibility=PUBLIC`, `moderationStatus=APPROVED`, and no `hiddenAt`. Collection display additionally requires collection authorization. Owners may see status placeholders for their non-approved uploads, but components do not render the underlying file URL.
