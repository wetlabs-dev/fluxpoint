# Fluxpoint post-audit remediation

Date: 2026-07-10

## Executive summary

The post-audit hardening pass implemented persistent collection context, a durable asynchronous cover-image queue, atomic AI job claims, stale recovery/retries/dead-lettering, advisory locks for all shared recurring-worker ticks, truthful worker health, public DTO identifier minimization, one proven-safe legacy-column removal, and dead server-action cleanup. A disposable production-like Compose environment was migrated, seeded, built, exercised, backed up, and restored.

Runtime verification found and fixed three reproducible P1 defects: the AI worker imported Next-only server code; the backup tools used a PostgreSQL client newer than the PostgreSQL 16 server; and Viewer users were shown an aquarium-create form even though the server rejected the mutation.

## Files and schema

Migration `20260710160000_post_audit_hardening`:

- adds `User.activeCollectionId` with `ON DELETE SET NULL`;
- adds `AiJobType`, `AiJobStatus`, and indexed `AiJob` persistence;
- removes `Aquarium.generatedName` after zero-reader/zero-writer proof.

No other compatibility column was removed. Active fallback readers or incomplete canonical fixture values remain for aquarium salinity, profile equipment slots, lighting channels/ramps, and historical husbandry JSON; evidence is recorded in `docs/maintenance/legacy-field-remediation-2026-07.md`.

## Collection switching

The app shell loads accessible active collections and persists one selection per user. Server validation rejects inaccessible or archived collections. Stale selections fall back to the oldest accessible active collection and persist the fallback. Stable list routes survive a switch; entity/detail routes return to `/dashboard`.

Automated tests covered two memberships, unauthorized selection visibility, membership-removal fallback, persistence, and user isolation. Browser testing confirmed selection across refresh and safe detail-route fallback.

## AI queue and worker

`src/domains/ai-jobs` contains typed payload validation, enqueue/idempotency, claims, registry, handler, worker-safe cover generation, queries, actions, and serializers. The worker uses `FOR UPDATE SKIP LOCKED`, bounded batches, claim identity, attempt increments, stale recovery, bounded retry delay, terminal failure classification, dead-letter status, and safe errors.

The cover handler revalidates aquarium existence and current structural permission. OpenAI mode still calls `/v1/images/generations`; text Responses/Chat are not used for final pixels. The result persists media and moderation state. Optimistic assignment compares the cover present at enqueue time, so a newer manual cover is not overwritten.

The Eddy UI shows queued/running progress, cancel, retry, completion, and safe failure. `/server-maintenance/ai-jobs` shows sanitized counts, recent jobs, latest worker state, and admin retry/cancel controls.

Mock runtime result: one job, one claim, one attempt, approved media persisted, `assignedAsCover=true`, completed job result recorded. A real OpenAI call was not performed because no test credential was used.

## Worker locking and health

The shared worker harness acquires a deterministic PostgreSQL transaction advisory lock for every tick. Lock contention records a successful skipped run rather than a failure. AI jobs additionally use row-level atomic claims and idempotency.

Runtime contention proof held the `ai-worker` advisory key in a separate database session; duplicate worker processes recorded `Skipped because another worker owns the advisory lock.`

Server Maintenance classifies optional workers as `DISABLED`, `NEVER_RUN`, `HEALTHY`, `STALE`, `RUNNING`, or `FAILED`. Disabled workers are informational. Existing notification integration already selects only open WARNING/CRITICAL incidents; the isolated notification test confirmed an INFO incident produced no delivery.

## Public privacy contract

Public DTO output no longer contains internal aquarium, item, photo, schedule, assignment, event, or species IDs. UI keys use public slugs/media URLs, timestamps, and display-derived public keys. Database IDs remain only inside server query types and protected media authorization.

Anonymous runtime results:

- public collection: 200
- published aquarium: 200
- unpublished aquarium: 404
- approved published media: 200
- private media: 404
- censored media: 404

## Dead actions

Removed after repository-wide consumer searches:

- `processWorkflowNotificationsNow`
- `saveSpeciesHusbandryOverrideFieldAction`
- `createReading`
- `generateQrCode`
- `generateAiCoverImage`
- synchronous `generateAiCoverImageForAquarium`

Replacements and rollback guidance are in `docs/maintenance/removed-legacy-actions-2026-07.md`.

## Disposable runtime environment

`docker-compose.remediation.yml` supplies isolated database/uploads/labels/reports/backups/restore volumes, mock AI configuration, app port 3100, database test port 55432, and restore database port 55433. Hard-coded production container names initially blocked project isolation; the override now supplies remediation-only names without changing production deployment names.

Fixtures included server admin with 2FA, owner, aquarist, fishkeeper, viewer, multi-membership and disabled users, private/public collections, published/unpublished aquariums, species/inventory, demo operational records, account request, media boundary rows, and an AI cover job.

## Verification summary

| Area | Result |
|---|---|
| Prisma validate/generate/migrate status | Pass; 62 migrations current |
| Clean database migration | Pass |
| TypeScript | Pass |
| Focused `check:*` suite | Pass except first guarded notification attempt lacked demo data; rerun passed after documented fixture seed |
| Notification delivery/dedup/INFO suppression | Pass; 11 deduplicated deliveries |
| Collection switch integrity | Pass |
| Post-audit queue/privacy/dead-code check | Pass |
| AI worker mock execution | Pass |
| Advisory lock contention | Pass |
| Anonymous/public boundary | Pass |
| App readiness | 200 JSON readiness |
| Docker app build | Pass |
| Backup plus separate restore | Pass after PostgreSQL client pin |

Browser smoke tests covered multi-collection selection, safe route fallback, Viewer UI, server-admin 2FA, worker health, and AI queue administration. Owner/aquarist/fishkeeper permission semantics remained enforced by existing server role checks and focused integrity scripts; every individual mutation form was not manually exercised in the browser.

## Remaining risks and deferred work

- Real OpenAI Images API execution was not tested; mock provider proved the complete queue/storage/moderation/assignment path.
- Queue completion notifications remain polling-only until a dedicated preference is designed.
- The advisory lock serializes a named worker tick, while queue idempotency/claims remain the source of per-record safety.
- Legacy salinity/profile/lighting/husbandry fields remain until zero-fallback evidence exists.
- The full role matrix was sampled rather than exhaustively browser-clicked across every mutation.

## Production deployment checklist

1. Back up production before migration.
2. Set `ENABLE_AI_WORKER=true` and review AI interval/batch/stale/max-attempt settings.
3. Deploy with the standard `docker compose up -d --build` path.
4. Start optional workers with the `workers` profile where required.
5. Confirm migration completion and `/api/ready`.
6. Confirm AI worker `HEALTHY`, enqueue one controlled cover, and inspect `/server-maintenance/ai-jobs`.
7. Confirm active collection selection for a multi-membership account.
8. Create and validate a fresh production backup before relying on the new queue operationally.
