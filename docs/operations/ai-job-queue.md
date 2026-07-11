# Durable AI job queue

Expensive cover image generation is asynchronous. The Eddy UI enqueues `AQUARIUM_COVER_IMAGE_GENERATION`, receives an `AiJob` identifier, and polls the authenticated job endpoint for progress.

The queue stores typed payloads, status, priority, attempts, availability, claim ownership, progress, safe errors, results, and an idempotency key. The worker claims bounded batches with `FOR UPDATE SKIP LOCKED`, recovers stale claims, retries transient failures with bounded delay, and dead-letters exhausted jobs.

The handler revalidates aquarium existence and requester permission. OpenAI mode uses the Images API; mock mode writes a local test image. The queued cover ID prevents a completed older job from overwriting a newer manual cover selection.

Configuration: `ENABLE_AI_WORKER`, `AI_WORKER_INTERVAL_SECONDS`, `AI_WORKER_BATCH_SIZE`, `AI_JOB_STALE_CLAIM_MINUTES`, and `AI_JOB_MAX_ATTEMPTS`. Administrators inspect the sanitized queue at `/server-maintenance/ai-jobs`.
