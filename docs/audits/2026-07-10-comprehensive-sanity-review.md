# Fluxpoint comprehensive sanity review

Date: 2026-07-10

## Executive summary

Fluxpoint is a broad, internally coherent application with strong schema coverage, explicit collection scoping, durable audit primitives, protected media delivery, generated documentation, and a production build that passes. The repository is suitable for staging and controlled real-data trials. It should not yet be treated as fully production-proven for irreplaceable data because the live Docker/database environment was unavailable during this review, so migrations, authenticated workflows, anonymous publication rules, backups, and worker execution could not be exercised against a running stack.

No confirmed P0 data-loss, authorization, or privacy vulnerability was found by static tracing. One definite P2 worker disconnect and substantial README drift were fixed in this pass. The principal remaining risks are operational verification, single-active-collection behavior, worker concurrency/idempotency, an intentionally empty AI worker, several legacy compatibility fields, and a small set of unlinked server actions.

### Top risks

1. **P1 — production runtime not verified:** Docker was unavailable and all database-backed checks were blocked at `db:5432`. Requires production verification.
2. **P2 — multi-collection users cannot select context:** `getUserCollection` always chooses the oldest active collection. Requires design decision.
3. **P2 — recurring workers have no distributed lock:** two deployments can process the same due work concurrently. Requires design decision and production verification.
4. **P2 — `ai-worker` is operationally empty:** enabling it records successful no-op ticks, which can imply work is occurring. Requires design decision.
5. **P2 — worker services are opt-in and mostly disabled in example configuration:** reminders, backups, moderation, and intelligence do nothing until both profile and flag are enabled. Requires deployment verification.
6. **P2 — legacy source-of-truth fields remain:** aquarium salinity/name/profile and lighting point compatibility columns require continued synchronization. Requires migration/backfill planning, not deletion here.
7. **P2 — custom care recurrence is deliberately incomplete:** the UI/schema supports bounded cadence types rather than a general recurrence engine. Requires design decision.
8. **P3 — public serializers expose internal database IDs:** pages do not appear to depend on every serialized `id`; minimize in a dedicated privacy hardening pass. Requires design decision.
9. **P3 — five exported server actions have no consumer:** these create dead alternative mutation paths and maintenance ambiguity.
10. **P3 — device control and hardware alerting are deliberately absent:** lighting and metrics are configuration/observation surfaces, not automation controllers.

### Strongest areas

- Collection-aware authorization helpers are consistently used by sampled mutations and admin routes.
- Public media is served through a dedicated route that requires approval, rejects unsafe/hidden/private assets, and checks publication state.
- Audit writes are centralized and broadly present across mutation domains.
- Docker persistence is explicit for PostgreSQL, uploads, labels, reports, backups, Prometheus, Grafana, and Caddy state.
- The generated manual is current, and 27 focused integrity scripts cover the major product domains.
- `check:production` passes and all application/API/QR/public routes compile.

### Weakest areas

- There are almost no conventional unit/integration test files; confidence depends on custom check scripts and runtime testing.
- Operational workers depend on deployment flags/profile selection and lack cross-process locks.
- Collection selection is implicit and makes multi-membership behavior surprising.
- README feature/roadmap text had drifted far behind implemented labels, thumbnails, invitations, transfers, AI, and workflow features; the obvious stale claims were corrected.

### Real-data readiness

**Conditional, not unconditional.** It is reasonable to populate reversible staging or backed-up real data. Before irreplaceable production data, run the full database-backed check suite, migration status, authenticated workflow smoke tests, anonymous publication/media tests, and an actual backup/restore rehearsal on the deployment host.

## Repository inventory

### Route matrix

| Route group | Auth | Required role | Main source | Status |
|---|---|---|---|---|
| `/`, `/fluxpoint`, `/fluxpoint/features`, `/marketing-preview` | none | none | marketing components | Complete |
| `/login`, `/forgot-password`, `/reset-password`, `/request-account`, `/invite/[token]`, `/two-factor` | mixed/anonymous | token or challenge where applicable | auth/account-request domains | Complete statically; runtime verification required |
| `/dashboard` | required | collection viewer | aquarium, task, workflow, reading queries | Complete statically |
| `/aquariums`, `/aquariums/[id]` | required | viewer; mutations structural/care roles | aquarium and management domains | Complete statically |
| `/aquariums/[id]/plan`, `/plans/[planId]` | required | collection viewer/structural mutations | aquarium-plan domain | Complete statically |
| `/aquariums/[id]/audit/**` | required | collection roles | tank-audit domain | Complete statically |
| `/species/**` | required | viewer/structural mutations | species, husbandry, management | Complete statically |
| `/inventory/**`, `/equipment/**`, `/storage`, `/quarantine` | required | viewer; care/structural mutations | management, history, media | Complete statically |
| `/breeding/**` | required | viewer; structural mutations | breeding domain | Complete statically |
| `/conditions/**`, `/medications` | required | viewer; care mutations | conditions/management | Complete statically |
| `/schedules`, `/lighting-schedules`, `/workflows/**` | required | viewer; role-gated mutations | management/workflows/lighting | Complete; custom recurrence/device control intentionally partial |
| `/planning`, `/emergency-response`, `/intelligence` | required | collection roles | plans/emergencies/intelligence | Complete statically |
| `/metrics` | required | collection roles | metrics/Prometheus/Grafana | Complete statically; external backends unverified |
| `/labels` | required | care roles for generation | labels and QR domains | Complete; middleware explicitly permits generated files |
| `/collection`, `/collection/audit-log`, `/collection/tank-summaries` | required | viewer/owner by action | collection/public/water/audit | Complete; collection switching absent |
| `/account`, `/account/security`, `/help` | required | signed-in user | account/notifications/manual | Complete statically |
| `/server-maintenance/**`, `/settings` | required | server admin + 2FA | server/admin domains | Complete statically; live operations unverified |
| `/browse/**` | none | published collection/aquarium | public queries/serializers | Complete statically |
| `/browse-preview/[aquariumId]` | required | collection viewer | public serializer in preview mode | Complete; creates missing preview profiles intentionally |
| `/q/**`, `/public/q/[code]` | mixed | collection viewer or explicitly published target | QR scan domain | Complete statically |
| `/api/eddy/**` | required | feature-specific collection role | Eddy/AI domains | Complete statically; provider unverified |
| `/api/media/**` | mixed | uploader/viewer/admin or published rules | media service/permissions | Complete statically |
| `/api/labels/**`, `/api/qr/**` | required | care role | label/QR services | Complete statically |
| `/api/metrics/**` | token or scrape config | ingestion token / deployment boundary | metrics service | Complete statically |
| `/api/push-subscriptions/**` | required | signed-in user | notification/push domains | Complete statically |
| `/api/health`, `/api/ready` | none | none | health/readiness | Complete statically |

Navigation was checked in `AppShell`, aquarium workspace tabs, server-maintenance links, public marketing navigation, help links, and QR redirects. Every hard-coded first-party destination sampled has a compiled route.

### Feature completeness matrix

| Feature | Schema | Backend | UI | Integration | Worker | Docs | Checks | Status |
|---|---|---|---|---|---|---|---|---|
| Authentication/2FA/accounts | Strong | Strong | Strong | Strong | n/a | Strong | dedicated | Complete statically |
| Collections/memberships | Strong | Strong | Strong | Partial: no switcher | n/a | Strong | account requests | Partial |
| Aquariums/timeline | Strong | Strong | Strong | Strong | intelligence/reminders | Strong | multiple | Complete statically |
| Species/husbandry/variants | Strong | Strong | Strong | Strong | n/a | Strong | dedicated | Complete statically |
| Inventory/equipment/storage | Strong | Strong | Strong | Strong | reminders | Strong | dedicated | Complete statically |
| Quarantine | Strong | Strong | Strong | Strong | reminders | manual | notification checks | Complete statically |
| Breeding | Strong | Strong | Strong | Strong | n/a | Strong | dedicated | Complete statically |
| Conditions/treatments/medications | Strong | Strong | Strong | Strong | reminders | manual | dedicated | Complete statically |
| Care/lighting schedules | Strong | Strong | Strong | Partial by design | reminders | Strong | light/notifications | Partial |
| Workflows | Strong | Strong | Strong | Strong | reminders | Strong | dedicated | Complete statically |
| Tank plans/revisions | Strong | Strong | Strong | Strong | n/a | Strong | plan-related checks | Complete statically |
| Emergency response | Strong | Strong | Strong | Strong | n/a | manual | build only | Complete statically |
| Metrics/Prometheus/Grafana | Strong | Strong | Strong | External runtime | metrics | Strong | build/static | Needs runtime verification |
| Aquarium intelligence | Strong | Strong | Strong | Strong | intelligence | Strong | dedicated | Worker fixed; runtime verification needed |
| Photos/moderation | Strong | Strong | Strong | Strong | image moderation | Strong | dedicated | Needs runtime verification |
| QR/labels | Strong | Strong | Strong | Strong | n/a | Strong | dedicated | Complete statically |
| Public browse | Strong | Strong | Strong | Strong | n/a | Strong | dedicated | Needs anonymous runtime tests |
| Eddy/AI | Strong logs/limits | Strong | Strong | Provider-dependent | placeholder AI worker | Strong | several | Partial operationally |
| PWA/notifications | Strong | Strong | Strong | Email/VAPID-dependent | reminders | Strong | dedicated | Needs provider/runtime tests |
| Server maintenance/backups | Strong | Strong | Strong | Host-dependent | metrics/backups | Strong | build/static | Needs backup/restore rehearsal |
| Audit logging | Strong | Centralized | Collection/admin views | Broad | worker events | Strong | production gate | Strong |
| Manual/docs | n/a | generator | `/help` | screenshots | docs service | Strong | `docs:check` | Current |
| Docker/deployment | n/a | services/volumes | n/a | Strong statically | six operational workers | Strong | Compose inspection | Needs live host verification |

## Findings

### P1 — Live deployment and populated-data behavior unverified

- **Files:** `docker-compose.yml`, `prisma/migrations/**`, `scripts/check-*.ts`.
- **Observed:** Docker daemon was unavailable; the first DB-backed integrity check could not reach `db:5432`.
- **Expected:** migrations apply cleanly to a populated clone and all integrity/runtime smoke checks pass.
- **Risk:** migration assumptions, runtime permissions, file ownership, and external integrations can fail despite a successful build.
- **Fix:** run the follow-up checklist below on a backed-up deployment clone.
- **Scope:** medium; production verification. **Safe now:** no, environment required.

### P2 — Aquarium intelligence worker was disconnected (fixed)

- **Files:** `scripts/workers/intelligence.ts`, `docker-compose.yml`, `.env*.example`, deployment docs.
- **Observed:** package command and worker-run recording existed, but no Compose service or enable/interval configuration existed; the script was one-shot.
- **Expected:** opt-in recurring worker using the shared run/incident harness.
- **Risk:** intelligence assessments and alerts silently become stale.
- **Fix made:** converted it to `runWorker`, added `ENABLE_INTELLIGENCE_WORKER`, hourly interval default, Compose service, docs, and restore stop command.
- **Scope:** small; safe quick fix; production verification still required.

### P2 — No collection switcher

- **Files:** `src/lib/auth/session.ts`, `src/components/layout/app-shell.tsx`.
- **Observed:** the oldest active accessible collection is selected; memberships beyond it have no selection UI.
- **Expected:** explicit persisted/request-scoped collection choice.
- **Risk:** users can appear unable to reach valid memberships and may act in an unintended collection.
- **Fix:** add a collection-context selector and validate every switch against membership; migrate no domain data.
- **Scope:** medium; requires design decision. **Safe now:** no.

### P2 — Workers lack distributed locking

- **Files:** `scripts/workers/lib.ts`, worker tick implementations.
- **Observed:** each process loops independently; no PostgreSQL advisory lock or lease prevents overlapping replicas/deployments.
- **Expected:** one active tick per worker name, with idempotent claims for queued records.
- **Risk:** duplicate notifications, repeated AI work, or competing backup/moderation processing.
- **Fix:** add per-worker advisory locking and transactional row claims where queues exist.
- **Scope:** medium; design and production verification required. **Safe now:** no.

### P2 — AI worker reports successful no-op ticks

- **Files:** `scripts/workers/ai-worker.ts`, `docker-compose.yml`.
- **Observed:** the worker has no `tick`; if enabled it records generic success indefinitely.
- **Expected:** either a real durable AI queue consumer or no deployable service/flag.
- **Risk:** false operational confidence.
- **Fix:** define the intended queue and idempotency contract, or remove the service in a separate bounded change while preserving synchronous Eddy features.
- **Scope:** small-to-medium; requires design decision. **Safe now:** no.

### P2 — Worker enablement is easy to misconfigure

- **Files:** `.env.production.example`, `docker-compose.yml`, operations docs.
- **Observed:** most workers require both the `workers` profile and an enable flag; disabled containers sleep and can look healthy.
- **Expected:** maintenance UI or deployment checklist clearly distinguishes absent, disabled, stale, and healthy workers.
- **Risk:** reminders, backups, moderation, and intelligence may silently not run.
- **Fix:** add expected-worker status cards keyed to flags and latest run age; verify production flags.
- **Scope:** medium; requires production verification. **Safe now:** no.

### P2 — Compatibility fields have synchronization risk

- **Files:** `prisma/schema.prisma`, aquarium/lighting/husbandry services and migrations.
- **Observed:** `Aquarium.generatedName`, legacy salinity, `AquariumProfile` slot/free-text fields, and lighting point legacy channels coexist with canonical replacements.
- **Expected:** canonical fields remain explicit and compatibility fields are backfilled/validated until a planned removal.
- **Risk:** old and new readers can disagree.
- **Fix:** add invariant checks and telemetry, then perform a separately reviewed backfill/removal migration.
- **Scope:** large; migration and user-data backfill. **Safe now:** no.

### P2 — General recurrence and hardware control are intentionally partial

- **Files:** schedule schema/actions, lighting domain, README/manual.
- **Observed:** custom recurrence is a placeholder; lighting schedules do not control devices.
- **Expected:** UI continues to describe these as scheduling/configuration rather than automation.
- **Risk:** expectation mismatch rather than present data corruption.
- **Fix:** keep explicit limitations; design RRULE/device adapters separately.
- **Scope:** large; design decision. **Safe now:** no.

### P3 — Public DTOs include internal IDs

- **Files:** `src/domains/public/public-serializers.ts`.
- **Observed:** collection-safe public objects still return aquarium, item, photo, schedule, and species IDs.
- **Expected:** return only identifiers needed for rendering/interaction, preferably public slugs/codes.
- **Risk:** unnecessary internal topology exposure; no direct authorization bypass found.
- **Fix:** inventory client key/use requirements and remove unused IDs with response-contract tests.
- **Scope:** small-to-medium; privacy hardening. **Safe now:** not without client contract review.

### P3 — Unlinked server actions

- **Files:** `src/domains/workflows/actions.ts`, `src/domains/management/actions.ts`, `src/domains/aquariums/actions.ts`.
- **Observed:** `processWorkflowNotificationsNow`, `saveSpeciesHusbandryOverrideFieldAction`, `createReading`, `generateQrCode`, and `generateAiCoverImage` have no source consumer; newer batch/service/API paths are used instead.
- **Expected:** one clear mutation path or a documented intentional API.
- **Risk:** dead paths drift and confuse future maintenance.
- **Fix:** confirm no external server-action contract, then remove wrappers in a cleanup PR.
- **Scope:** small; cleanup. **Safe now:** no automatic deletion per audit rules.

### P3 — README drift (fixed)

- **Files:** `README.md`.
- **Observed:** current limitations/roadmap claimed QR/PDF labels, thumbnails, invitations, transfers, AI, and workflows were absent although implementation exists.
- **Expected:** README agrees with current product/docs.
- **Risk:** operators and contributors make incorrect decisions.
- **Fix made:** replaced stale claims with the remaining real limitations.
- **Scope:** small; safe quick fix.

### P3 — Prisma 7 configuration deprecation

- **Files:** `package.json`.
- **Observed:** Prisma warns that `package.json#prisma` will be removed in Prisma 7.
- **Expected:** use `prisma.config.ts` before upgrading.
- **Risk:** future upgrade break, not a current runtime defect.
- **Fix:** migrate configuration in the dependency-upgrade pass.
- **Scope:** small; defer until upgrade.

## Dead/disconnected code list

- Unlinked server actions: the five actions listed above.
- `ai-worker`: deployed executable with no work function.
- `Aquarium.generatedName`: explicitly deprecated compatibility column; still intentionally preserved.
- Legacy workflow step enum values and lighting/husbandry compatibility data: reachable through normalization/read compatibility, not safe to delete.
- No API route was proven wholly unconsumed: `/api/qr` has no in-repo fetch consumer but is an authenticated programmatic endpoint; QR scan routes and label services use the same underlying service.
- No Prisma model was proven unused. Several join/dependent models are accessed through Prisma relation includes rather than direct client delegates, so name-count heuristics are not deletion evidence.

## Public/private and authorization review

- App pages are under the authenticated app layout; server-maintenance routes additionally require server admin and 2FA.
- Sampled mutations fetch the current collection and call `requireCollectionRole`; target records are generally selected with both `id` and `collectionId`.
- Public collections require `isPublicEnabled`; public aquariums require `isPublished`.
- Public media requires approved moderation, non-private visibility, no hidden/unsafe state, and either explicit public visibility or a published aquarium/collection.
- Private purchase/vendor/notes are not included in public item serializers. User emails are not serialized.
- Public aquarium render does not invoke AI.
- Anonymous QR fallback only reaches explicitly published collection/aquarium/item targets; otherwise it redirects to access denied.
- Runtime tests for approved/censored/private media and unpublished aquariums remain required because no live database was available.

## Worker/operational matrix

| Worker | Command/service | Interval | Volumes | Reporting | Idempotency/concurrency | Status |
|---|---|---|---|---|---|---|
| reminders | `worker:reminders` / profile | 5m default | none | shared worker runs/incidents | producer-level dedupe; no global lock | Configured, runtime unverified |
| metrics | `worker:metrics` / default service | 5m example | uploads/labels/reports/backups | shared worker runs/incidents | snapshot append; no global lock | Configured, runtime unverified |
| backups | `worker:backups` / profile | 60s | backups RW; content RO | shared worker runs/incidents + backup rows | queue state; no global lock | Configured, restore rehearsal needed |
| AI placeholder | `worker:ai` / profile | 5m harness default | none | misleading generic successes | no tick | Partial |
| image moderation | `worker:image-moderation` / profile | 180s | uploads RW | shared worker runs/incidents + reviews | pending-record processing; no global lock | Configured, runtime unverified |
| intelligence | `worker:intelligence` / profile | 1h default | none | shared worker runs/incidents | stale assessment check; no global lock | Registration fixed, runtime unverified |

## Docker and persistence checklist

- PostgreSQL: named persistent volume and health check present.
- App startup: waits for healthy DB, completed migration, and storage initializer.
- Uploads/labels/reports/backups: host mounts shared with relevant services; initializer assigns UID 1001.
- Prometheus/Grafana/Caddy: named persistent volumes present.
- Migrations: one-shot service gates app/workers; populated-data migration execution was not tested.
- Standalone runtime: production build succeeds and Dockerfile copies standalone/static/public assets.
- Backups: include database and file roots; actual archive plus restore plan/rehearsal not tested.
- Email/push/AI: configuration paths exist; provider credentials and deliveries were not tested.
- Health/readiness: compiled; runtime response not tested.
- Standard deployment command remains `docker compose up -d --build`.

## Verification record

| Command | Result | Approx. duration | Notes |
|---|---|---:|---|
| `git status --short` | Pass | <1s | clean at audit start |
| `npm run typecheck` | Pass | ~1s | no TypeScript errors |
| `DATABASE_URL=... npx prisma validate` | Pass | <1s | schema valid; package config deprecation warning |
| `npm run docs:check` | Pass | <1s | generated manual current |
| full database-backed check loop | Blocked | <1s | first check could not reach `db:5432` |
| `docker compose ps -a` | Blocked | <1s | Docker daemon unavailable |
| `DATABASE_URL=... npm run check:production` | Pass | ~22s | typecheck, Prisma generate, optimized build; all routes compiled |

## Recommended implementation sequence

### 1. Before irreplaceable production data

1. Start a backed-up production-like Compose stack and run `prisma migrate status` plus all `check:*` scripts.
2. Smoke-test every create/edit/delete/transfer/apply flow with owner, aquarist, fishkeeper, viewer, server admin, and anonymous users.
3. Test public/unpublished aquarium and approved/censored/private image delivery anonymously.
4. Enable required workers, verify latest `ServerWorkerRun`, then intentionally exercise one failure/recovery.
5. Create a sitewide backup and rehearse restore into an isolated database/filesystem.
6. Add distributed worker locks before horizontally duplicating worker processes.

### 2. Next refinement pass

1. Design and implement collection switching.
2. Replace the empty AI worker with a real queue consumer or remove its operational surface.
3. Add expected-worker status/age reporting to Server Maintenance.
4. Add end-to-end permission and public-boundary tests.
5. Add invariant checks for legacy/canonical field pairs.

### 3. After real-world use

1. Evaluate richer recurrence, hardware/device control, and external printer integrations based on observed demand.
2. Minimize public DTO IDs after recording actual client contracts.
3. Plan compatibility-column backfills and removals only with production data evidence.

### 4. Optional cleanup

1. Remove confirmed unlinked server-action wrappers.
2. Move Prisma seed configuration to `prisma.config.ts` during the Prisma 7 upgrade.
3. Expand conventional unit tests around transactions, recurrence, worker claims, and serializers.

## Bounded follow-up prompt

> Run Fluxpoint against a disposable production-like PostgreSQL/Compose stack. Apply migrations non-destructively, seed representative multi-role and public/private fixtures, run every `check:*` script, and smoke-test the route/mutation/public-media matrix from `docs/audits/2026-07-10-comprehensive-sanity-review.md`. Do not change product semantics. Fix only reproducible P0/P1 defects, then produce a command-by-command evidence report and a backup/restore rehearsal record.
