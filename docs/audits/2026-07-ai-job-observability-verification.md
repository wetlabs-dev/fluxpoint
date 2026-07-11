# AI job observability and provider verification

## Executive summary

Fluxpoint now retains durable, sanitized AI job histories and makes the existing priority field operational. Interactive aquarium covers are HIGH priority, claims are strict priority then availability then FIFO, and both keepers and server administrators can inspect understandable timelines. Real-provider verification evidence is recorded separately and is never claimed without an actual Images API call.

## Schema and event model

`AiJobEvent` cascades with its `AiJob` and records typed lifecycle events, an optional status snapshot, safe message, sanitized bounded metadata, attempt number, and timestamp. Indexes support chronological job inspection and event-type operations. The canonical helper strips credentials, authorization, base64/binary fields, and large values.

## Lifecycle

Coverage includes enqueue/deduplication, claim/start, provider request/response, media persistence, moderation, optimistic cover assignment or skip, completion, failure/retry/dead-letter, cancellation, admin retry, and priority change. `AiJobEvent` is operational history; `AuditLog` remains limited to meaningful user/admin and record-changing actions; `ServerWorkerRun`, AI usage, and moderation records are not duplicated.

## Priority and claiming

Canonical tiers are IMMEDIATE 10, HIGH 25, NORMAL 100, LOW 200, and MAINTENANCE 500. Lower is earlier; IMMEDIATE is reserved. Claims order by priority, `availableAt`, and `createdAt` under `FOR UPDATE SKIP LOCKED`. V1 uses strict tiers with FIFO and observes backlog age rather than speculative aging.

## UI and administration

Eddy polls and displays chronological activity, timestamps, attempts, priority, retry timing, safe provider/model details, generated media, and cover assignment outcome. Server Maintenance adds global sanitized inspection, claim/failure details, backlog age by tier, timelines, media links, retry/cancel, and pending-only reprioritization.

## Moderation and security

Generated images are synchronously moderated, persisted as normal media with explicit status, and assigned only when approved. Payload/result serializers and event metadata omit credentials and binary content. Normal job access remains requester-scoped; server administrators retain the existing global policy.

## Retention

Policy is 90 days for completed jobs/events and 180 days for failed/dead-letter jobs. Media is never removed by job cleanup. Automation is deferred until support/audit hold rules are defined.

## Verification and remaining risks

Automated verification covers event creation, priority/FIFO/delay order, concurrent claim exclusion, metadata sanitation, retry/failure milestones, persistence, production build, and container builds. The isolated mock path completed with approved persisted media and cover assignment; authenticated admin inspection and aquarium reload were verified. A fake-key request proved safe retry scheduling without reaching paid image generation. The controlled real-provider evidence is in `docs/operations/real-openai-image-verification-2026-07.md`; real-provider success remains **BLOCKED** because no credential was available. Provider request ID, cost, live public rendering, and OpenAI dashboard confirmation remain operator checks.

## Production rollout checklist

1. Back up PostgreSQL and uploads.
2. Deploy the migration before app/workers.
3. Confirm AI worker configuration and Images API credential/model.
4. Deploy app and worker images together.
5. Run one controlled cover job and inspect events, usage, media, moderation, assignment, authenticated/public rendering, and reload persistence.
6. Monitor HIGH backlog age, failures, dead letters, and event-write errors.
7. Roll back application containers if necessary; retain the additive event table safely.
