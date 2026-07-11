# Durable AI job queue

Expensive cover image generation is asynchronous. The Eddy UI enqueues `AQUARIUM_COVER_IMAGE_GENERATION`, receives an `AiJob` identifier, and polls the authenticated job endpoint for progress.

The queue stores typed payloads, status, priority, attempts, availability, claim ownership, progress, safe errors, results, and an idempotency key. `AiJobEvent` stores a durable, chronological, user-safe history of enqueue, claim, provider, media, moderation, assignment, retry, cancellation, and completion milestones. Event metadata is centrally sanitized; authorization values, API keys, binary/base64 image data, and oversized provider bodies are never retained.

The worker claims bounded batches with `FOR UPDATE SKIP LOCKED`, recovers stale claims, retries transient failures with bounded delay, and dead-letters exhausted jobs. Ordering is strict priority, then `availableAt`, then creation time. V1 deliberately uses FIFO inside each tier and does not implement aging; Server Maintenance exposes backlog age by tier so starvation can be observed before adding complexity.

Priority values use lower numbers for more urgent work: `IMMEDIATE=10` (reserved), `HIGH=25` (interactive Eddy work), `NORMAL=100`, `LOW=200`, and `MAINTENANCE=500`. A user-triggered retry is promoted to HIGH. Only server administrators can reprioritize a pending job.

The handler revalidates aquarium existence and requester permission. OpenAI mode uses the Images API; mock mode writes a local test image. The queued cover ID prevents a completed older job from overwriting a newer manual cover selection.

Configuration: `ENABLE_AI_WORKER`, `AI_WORKER_INTERVAL_SECONDS`, `AI_WORKER_BATCH_SIZE`, `AI_JOB_STALE_CLAIM_MINUTES`, `AI_JOB_MAX_ATTEMPTS`, and `AI_JOB_HIGH_PRIORITY_WARNING_MINUTES`. Administrators inspect sanitized payloads, results, failures, claims, and timelines at `/server-maintenance/ai-jobs`.

Retention policy: keep completed jobs and their events for 90 days and failed/dead-letter jobs for 180 days. Media is independent and must never be deleted by job cleanup. Automatic deletion is intentionally deferred until support/audit hold semantics are defined.
