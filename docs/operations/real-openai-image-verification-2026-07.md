# Real OpenAI image verification — July 2026

## Status

**Real Images API success: BLOCKED.** On 2026-07-10, neither the shell nor `.env`, `.env.local`, or `.env.production` contained a configured `OPENAI_API_KEY`. No paid provider call was attempted and no success is claimed. Secrets and image binary data are intentionally omitted.

**Implementation and isolated mock lifecycle: PASSED.** Disposable Docker project `fluxpoint-remediation` used a new PostgreSQL volume on port 55432, separate upload volumes, and the mock provider. Job `cmrfnfwq7001001ncowphx0m6` completed with events `ENQUEUED → CLAIMED → STARTED → PROVIDER_REQUEST_STARTED → PROVIDER_RESPONSE_RECEIVED → MEDIA_SAVED → MODERATION_COMPLETED → COVER_ASSIGNED → COMPLETED`. Media `cmrfnfx8x000t01pvnv4j56yr` persisted as an approved 1024×1024 PNG and remained the aquarium cover after reload.

**Controlled failure: PASSED.** A nonexistent-aquarium job ended safely as `FAILED` with no media. A valid job with a deliberately fake key made one rejected OpenAI moderation request, remained `PENDING` with `FAILED` and `RETRY_SCHEDULED` events, exposed no key, created no media, and did not change the cover. It never reached the paid Images endpoint.

## Environment and commands

Use an isolated PostgreSQL database and uploads volume, never the production database. Set `AI_PROVIDER=openai`, `AI_ENABLED=true`, `AI_IMAGE_ENABLED=true`, `AI_MODERATION_ENABLED=true`, `OPENAI_API_KEY`, `OPENAI_COVER_IMAGE_MODEL=gpt-image-1-mini`, then deploy migrations, seed a disposable aquarium, enqueue one cover, and run `npm run worker:ai` once. Inspect the authenticated Eddy page, public/private routes, `AiRequestLog`, `AiJobEvent`, `MediaAsset`, and the aquarium cover after reload.

Sanitized commands used for this run:

```bash
docker compose -p fluxpoint-remediation -f docker-compose.yml -f docker-compose.remediation.yml build app migrate ai-worker
docker compose -p fluxpoint-remediation -f docker-compose.yml -f docker-compose.remediation.yml up -d db
docker compose -p fluxpoint-remediation -f docker-compose.yml -f docker-compose.remediation.yml run --rm migrate
DATABASE_URL='postgresql://[redacted]@127.0.0.1:55432/fluxpoint?schema=public' npx tsx scripts/seed-remediation-fixtures.ts
DATABASE_URL='postgresql://[redacted]@127.0.0.1:55432/fluxpoint?schema=public' npx tsx scripts/check-ai-job-observability.ts
DATABASE_URL='postgresql://[redacted]@127.0.0.1:55432/fluxpoint?schema=public' npx tsx scripts/verify-ai-job-lifecycle.ts
docker compose -p fluxpoint-remediation -f docker-compose.yml -f docker-compose.remediation.yml down -v
```

When an operator supplies a credential, the sanitized worker log must include `endpoint: images.generations`; final pixels must not come from Responses or Chat. Capture job ID, provider request ID if returned, model, media ID, status, dimensions/format, moderation result, assignment outcome, usage record, authenticated/public reload results, cost/image usage, and a manual OpenAI dashboard observation. These real-provider fields remain unverified in this run.

## Controlled failure

Use handler-level mock failure or a temporary fake key in the isolated environment. Confirm a safe `FAILED` event and `RETRY_SCHEDULED` or terminal state, with no media or cover mutation and no credential in events/logs. Do not make repeated paid calls.
