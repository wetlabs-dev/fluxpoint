# Fluxpoint

Fluxpoint is a modern, cozy aquarium management system for tracking tanks, livestock, plants, hardscape, equipment, husbandry, water parameters, workflows, QR labels, audit history, and AI-assisted naming and cover-card ideas.

The first version is built as a serious long-term application foundation, not a throwaway prototype. It uses a dashboard-first Next.js App Router UI, Prisma domain models, reusable components, typed validation, server actions, and clean service boundaries for future AI, metrics, QR, and audit features.

Design notes live in [`docs/design/typography.md`](docs/design/typography.md) and [`docs/design/theme.md`](docs/design/theme.md).

Product notes for the current lighting, inventory, and husbandry model live in [`docs/product/lighting-schedules.md`](docs/product/lighting-schedules.md), [`docs/product/inventory-transfers.md`](docs/product/inventory-transfers.md), [`docs/product/quarantine.md`](docs/product/quarantine.md), and [`docs/product/species-husbandry.md`](docs/product/species-husbandry.md).

Required UI testing rule: whenever making CSS, layout, or UI component changes, test affected authenticated app screens in both light and dark modes before considering the task complete. Whenever making splash/marketing page changes, test the splash page while the app/system theme is dark and confirm it still renders in light mode only.

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn-inspired local UI primitives
- Prisma
- PostgreSQL
- Docker Compose
- Caddy

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create your local environment:

```bash
cp .env.example .env
```

3. Start the local Postgres stack:

```bash
cp .env.production.example .env.production
docker compose up -d db
npm run db:migrate:deploy
npm run db:bootstrap
```

4. Start the app:

```bash
npm run dev
```

Open `http://localhost:3000` for the Wetlabs umbrella homepage or `http://localhost:3000/dashboard` for the authenticated Fluxpoint app.

For a second local preview route to the portable Fluxpoint marketing page, open `http://localhost:3000/marketing-preview`.

## Authentication

Fluxpoint uses first-party credentials authentication with hashed passwords and database-backed sessions. Sessions are stored in Postgres and sent to the browser as an `HttpOnly` cookie.

Set these before bootstrapping a real deployment:

```bash
ADMIN_EMAIL="you@example.com"
ADMIN_PASSWORD="use-a-long-unique-password"
AUTH_SECRET="use-a-long-random-secret"
NEXTAUTH_URL="https://fluxpoint.wetlabs.dev"
```

`npm run db:bootstrap` creates or updates the initial admin user from `ADMIN_EMAIL` and `ADMIN_PASSWORD`. Passwords are hashed with Node `crypto.scrypt`; plaintext passwords are never stored. If admin env vars are missing, bootstrap logs a warning and falls back to the local seed account.

First login:

1. Run migrations and bootstrap.
2. Visit `/login`.
3. Log in with `ADMIN_EMAIL` and `ADMIN_PASSWORD`.

Protected app routes redirect unauthenticated users to `/login`. Public routes include `/`, `/fluxpoint`, `/fluxpoint/features`, `/marketing-preview`, `/api/health`, and `/api/ready`.

Password reset emails are supported through hashed, single-use reset tokens. Use `/forgot-password` to request a reset and `/reset-password?token=...` to complete it. The app never stores plaintext reset tokens.

## Prisma Commands

```bash
npm run db:generate
npm run db:migrate:dev
npm run db:migrate:deploy
npm run db:bootstrap
```

PostgreSQL is the supported database for development and production. Use migrations rather than `db push`.

## Deployment URLs

Fluxpoint separates the public marketing surface from the application surface:

- `https://www.wetlabs.dev` is the Wetlabs umbrella homepage and public project registry.
- `https://www.wetlabs.dev/fluxpoint` is the splash page / marketing page.
- `https://www.axildb.com` remains an external project destination; it is not proxied by Fluxpoint.
- `https://fluxpoint.wetlabs.dev` is the canonical Fluxpoint app.
- `https://wetlabs.dev` redirects to `https://www.wetlabs.dev` and preserves the requested path.
- The app should not be deployed with a Next.js `basePath` of `/fluxpoint`.
- App routes stay root-relative on the app subdomain: `/dashboard`, `/aquariums`, `/inventory`, `/equipment`, `/workflows`, and `/server-maintenance`.
- Local development still runs normally at `http://localhost:3000`, with the marketing preview available at `/marketing-preview`.

Required environment variables:

```bash
NEXT_PUBLIC_APP_URL="https://fluxpoint.wetlabs.dev"
NEXT_PUBLIC_MARKETING_URL="https://www.wetlabs.dev/fluxpoint"
NEXT_PUBLIC_SITE_NAME="Fluxpoint"
NEXT_PUBLIC_DONATE_URL="https://ko-fi.com/wetlabs"
NEXT_PUBLIC_GITHUB_URL="https://github.com/wetlabs-dev/fluxpoint"
NEXTAUTH_URL="https://fluxpoint.wetlabs.dev"
AUTH_SECRET="use-a-long-random-secret"
TOTP_ENCRYPTION_KEY="use-a-different-long-random-secret"
ADMIN_EMAIL="you@example.com"
ADMIN_PASSWORD="use-a-long-unique-password"
AI_ENABLED="true"
AI_PROVIDER="mock"
AI_RATE_LIMITS_ENABLED="true"
EDDY_DAILY_USER_LIMIT_DEFAULT="20"
EDDY_DAILY_COLLECTION_LIMIT_DEFAULT="100"
OPENAI_API_KEY=""
EMAIL_ENABLED="false"
EMAIL_PROVIDER="console"
EMAIL_DELIVERY_MODE="log"
APP_EMAIL_FROM="Fluxpoint <no-reply@wetlabs.dev>"
```

Public hosting setup:

- Route the full `www.wetlabs.dev` hostname to the Next.js app. `/` renders Wetlabs and `/fluxpoint` renders the Fluxpoint product page.
- Redirect the bare `wetlabs.dev` hostname to `https://www.wetlabs.dev`.
- Proxy `fluxpoint.wetlabs.dev` to the Fluxpoint Next.js app.
- Keep canonical metadata, Open Graph URLs, app launch CTAs, and cross-links sourced from the environment variables above.
- This repo exposes `/`, `/fluxpoint`, and `/marketing-preview` without moving app routes under `/fluxpoint`.
- Wetlabs assets live in `public/wetlabs/brand`, and the static registry for adding future projects lives in `src/lib/wetlabs-projects.ts`.

## Docker-First Production Deployment

Production deployment support lives in [`docs/deployment/docker-compose-caddy-postgres.md`](docs/deployment/docker-compose-caddy-postgres.md). Fluxpoint follows a Docker Compose production architecture:

- `caddy`: Dockerized public edge proxy on ports 80/443 with Let's Encrypt-managed certificates
- `db`: Postgres 16 persisted in the `fluxpoint_pgdata` Docker volume
- `migrate`: small one-shot Prisma migration service
- `bootstrap`: explicit one-time admin/sample-data setup in the optional `bootstrap` profile
- `app`: standalone Next.js server on the internal Compose network at port 3000
- `prometheus`, `grafana`: optional internal metrics stack in the `observability` profile
- `reminders`, `metrics`, `backups`, `ai-worker`, `image-moderation`, `intelligence`: optional containers in the `workers` profile; server metrics, backups, moderation, and aquarium intelligence persist operational history when enabled

The app port is not exposed directly to the public host. Caddy proxies both `fluxpoint.wetlabs.dev` and `www.wetlabs.dev` to `app:3000`; hostname and path determine whether visitors use the public marketing routes or protected application routes.

Docker readiness uses `/api/ready`, which verifies that the Next.js server is responding. `/api/health` remains the database-aware health endpoint for deeper checks after the stack is online.

## User Manual Screenshots

Fluxpoint can generate Help/User Manual screenshots through Docker Compose, which is the preferred production-server workflow because Playwright and its browser dependencies stay outside the app image:

```bash
docker compose --profile docs run --rm docs
```

The docs runner uses `http://app:3000` inside the Compose network and waits for the `app` service to become healthy. It reads `.env.production` and logs in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` by default.

If you want screenshots captured with a different account, create an optional override file:

```bash
cp .env.docs-screenshots.example .env.docs-screenshots
nano .env.docs-screenshots
docker compose --profile docs run --rm docs
```

Use `FLUXPOINT_DOCS_EMAIL` and `FLUXPOINT_DOCS_PASSWORD` for a dedicated screenshot account. If that account has TOTP enabled, set either `FLUXPOINT_DOCS_TOTP_CODE` for a one-time run or `FLUXPOINT_DOCS_TOTP_SECRET` for repeatable generation. `FLUXPOINT_DOCS_TOTP_SECRET` may be the raw base32 secret or a pasted `otpauth://` authenticator URL. Keep docs-only credentials and TOTP secrets in `.env.docs-screenshots` or server environment files, not git. The screenshots are written to `public/manual/screenshots/`.

Server Admin accounts must enable two-factor authentication before using server maintenance tools. Set `TOTP_ENCRYPTION_KEY` to a long random value in production; Fluxpoint uses it to encrypt authenticator secrets before storing them.

### Production Build Path

Build performance notes live in [`docs/dev/build-performance.md`](docs/dev/build-performance.md). Useful commands:

```bash
npm run docker:build:app
npm run docker:build:migrate
npm run docker:build:workers
npm run docker:up:build
./scripts/profile-build.sh
./scripts/profile-next-build.sh
```

The normal production update is deliberately just:

```bash
git pull --ff-only
docker compose up -d --build
```

The Dockerfile keys the expensive app dependency layer to `package-lock.json`, so npm script-only changes do not rerun `npm ci`. The default Compose graph starts only Caddy, Postgres, migrations, and the app; it builds the standalone app image and source-independent migration image. Bootstrap, worker tooling, Prometheus, and Grafana are outside the default profile and therefore do not participate in normal updates. Start optional services with `docker compose --profile workers up -d --build` or `docker compose --profile observability up -d --build`. Run `npm run check:production` in CI or a prepared checkout before deploying.

## Architecture Philosophy

Fluxpoint separates definition records from instance records. `SpeciesDefinition` describes what a species is, while `AquariumItem` records the actual fish, plant, hardscape, equipment, food, medication, or additive in the collection. Movement is generic: `ItemTransfer` can move any item between aquariums, storage locations, quarantine projects, and terminal outcomes such as consumed or removed.

Aquariums own the operating workspace: the timeline through `AquariumEvent`, current and historic readings through `WaterParameterReading`, recurring care through `CareSchedule` and `CareTask`, workflow runs through `WorkflowRun`, lighting assignments through `AquariumLightingAssignment`, QR payloads through `QrCode`, and AI concepts through `AiSuggestion`. Equipment is an item with an optional `EquipmentProfile`, which keeps the inventory model flexible while still supporting maintenance due indicators and light capability profiles.

The application is organized around durable domains:

- `src/domains/aquariums` for tank actions and metadata workflows
- `src/domains/husbandry` for species guides, linked guide resolution, item overrides, and field registries
- `src/domains/ai` for provider-ready mock/OpenAI services, moderation, and request logging
- `src/domains/email` for console/SES-compatible SMTP delivery, templates, and email logging
- `src/domains/audit` for audit logging helpers
- `src/domains/qr` for QR payload and placeholder label generation
- `src/lib/db`, `src/lib/validation`, and `src/lib/design` for shared infrastructure

## Working App Surfaces

- `/login`: credentials login for the bootstrapped admin user
- `/dashboard`: database-backed tank dashboard with active tank cards, recent activity, tracked item/event counts, equipment due count, and simple parameter alerts
- `/aquariums`: collection-scoped aquarium list and create form
- `/aquariums/[id]`: primary tank workspace with Overview, Inhabitants, Equipment, Metrics, Timeline, Schedules, AI Studio, and QR / Labels sections
- `/metrics`: Prometheus/Grafana backend status, metric definitions, ingestion tokens, managed dashboards, and sync logs
- `/medications`: collection medication definition library used by aquarium medication courses
- `/schedules`: recurring care schedules and generated care tasks for feeding, testing, water changes, maintenance, dosing, and equipment service
- `/species`: species definition library with category/search filters, derived scientific names, type-aware guidance, create/edit, and delete protection when in use
- `/inventory`: item list with type/placement/search filters, type-aware item categories, source/purchase metadata, create, archive, and transfer actions for aquariums, storage, quarantine, consumed, removed, and loss outcomes
- `/storage`: storage locations for bins, drawers, refrigerators, freezers, cabinets, and shelves, with stored item movement back to aquariums
- `/quarantine`: lightweight quarantine projects for moving inventory into observation, clearing entries, and completing or cancelling projects
- `/equipment`: equipment records using `AquariumItem` plus `EquipmentProfile`, maintenance due status, light capability profile selection, mark-maintained action, source/purchase metadata, and item QR payload generation
- `/lighting-schedules`: fixture-aware capability profiles, schedule designer, schedule previews, duplication, delete protection, and per-light assignment compatibility support
- `/workflows`: seeded workflow templates and collection run counts
- `/server-maintenance`: administrator-only server health, 48-hour RAM/disk/network history, incidents, real health checks, storage estimates, maintenance mode, backup browsing/cleanup, restore planning, worker runs, and priority audit events (`/settings` redirects here)
- `/server-maintenance/audit-log`: server-wide searchable, filterable, paginated audit history; Collection Owners get an isolated collection view at `/collection/audit-log`. Architecture, access rules, coverage, and redaction are documented in [`docs/operations/audit-log.md`](docs/operations/audit-log.md).
- `/api/metrics/ingest`: authenticated sensor/device metric ingestion using hashed Fluxpoint tokens
- `/api/metrics/prometheus`: Prometheus scrape endpoint for Fluxpoint-managed aquarium metrics
- `/api/qr/[entityType]/[entityId]`: QR payload placeholder endpoint

## Aquarium Workspace

`/aquariums/[id]` is the primary daily-use surface. Its URL-backed Overview, Inhabitants, Equipment, Metrics, Timeline, Schedules, Photos, Eddy, and Settings tabs keep tank identity, current care context, latest readings, recent events, and moderated media together without rendering one giant page. Approved aquarium photos can become dashboard covers; item, equipment, and timeline attachments remain linked to their source records.

Timeline events are first-class records. `EventCreateForm`, `TimelineList`, `TimelineItem`, and `EventTypeBadge` render reusable event flows for notes, feeding, water changes, test results, maintenance, medication, livestock additions/losses, plant additions/removals, stocking, deaths, spawns, photos, equipment changes, transfers, and other observations. Events can point at related items, species, schedule tasks, medication courses, structured event detail records, and linked water readings.

Parameter logging supports multi-reading entry for temperature, pH, ammonia, nitrite, nitrate, GH, KH, TDS, turbidity, CO2, light, and water level. The workspace shows range-aware current values and first-party seven-day charts queried from Prometheus, with visible min/max boundaries and a recent-reading fallback when Prometheus has no series. Metric configuration, ingestion tokens, and Grafana-managed dashboards remain available without becoming a second history system.

Maintenance logging records type, optional equipment, summary, notes, and can update linked equipment service dates. Water changes and feeding have structured event detail records. Medication definitions are separate from medication courses, and courses calculate dose from tank volume when dose-per-gallons information is available.

Care schedules generate practical `CareTask` records for daily, weekly, monthly, and every-N-days cadences. Completing or skipping a task advances the schedule and creates the next task. Completion can create a timeline event for aquarium-scoped tasks. Custom recurrence is intentionally a placeholder rather than an RRULE implementation.

Lighting schedules are modeled with `LightCapabilityProfile`, `LightingSchedule`, `LightingSchedulePoint`, and `AquariumLightingAssignment`. The designer supports capability profiles such as on/off, dimmable, RGB, and RGBW fixtures. Equipment lights choose a capability profile, and aquarium assignments validate schedule compatibility per light fixture. Device control is not implemented yet.

QR generation stores stable payloads such as `fluxpoint://aquarium/{id}` and `fluxpoint://item/{id}`. QR images and PDF labels remain future work.

## Eddy AI And Email Integration

Eddy is Fluxpoint's structured aquarium assistant; product behavior lives in [`docs/product/eddy.md`](docs/product/eddy.md) and provider notes live in [`docs/ai/eddy.md`](docs/ai/eddy.md). The feature registry and durable quota system live under `src/domains/eddy`. `AI_PROVIDER=mock` is the local-safe default and still respects rate limits. Set `AI_PROVIDER=openai` and `OPENAI_API_KEY` to enable live OpenAI calls. Provider, quota, and request-log status are visible in Server Maintenance.

Supported Eddy tools:

- tank summaries, care recommendations, and collection care digests;
- compatibility checks and stocking suggestions;
- tank names, cover concepts, and moderated cover image generation;
- troubleshooting questions;
- species care summaries and review-only husbandry drafts.

AI requests are persisted in `AiRequestLog`; daily/monthly counters are persisted in `AiRateLimitUsage`; moderation checks are persisted in `ModerationReview`; asynchronous cover work uses priority-aware `AiJob` records and sanitized chronological `AiJobEvent` histories. Generated cover images are created through the OpenAI Images API in OpenAI mode, configured by `OPENAI_COVER_IMAGE_MODEL`, `OPENAI_COVER_IMAGE_SIZE`, and `OPENAI_COVER_IMAGE_QUALITY`, and written under `public/uploads/ai`. Keeper uploads use `MediaAsset`, remain pending by default, and are processed fail-closed by the image-moderation worker before normal display. Upload moderation uses `ImageModerationReview` for uploader aquarium-content reviews and server-admin safety reviews.

Email delivery uses `src/domains/email/email-service.ts`. Local/dev defaults to the console provider. Production can use the SES-compatible SMTP provider with either `SMTP_*` values or AWS-style credentials:

```bash
EMAIL_ENABLED="true"
EMAIL_PROVIDER="ses"
EMAIL_DELIVERY_MODE="smtp"
AWS_REGION="us-east-1"
SMTP_FROM="Fluxpoint <no-reply@wetlabs.dev>"
SMTP_HOST="email-smtp.us-east-1.amazonaws.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="..."
SMTP_PASSWORD="..."
```

All sends create `EmailLog` rows. Password reset, collection invitation, and notification templates render both HTML and text. `NotificationDelivery` provides per-user/channel deduplication and delivery history for worker alerts.

## PWA And Notifications

Fluxpoint ships an installable manifest, Eddy home-screen icons, and a push-only service worker with no offline caching. Account Settings provides per-user Email and Push preferences, timezone/quiet-hours controls, device registration/revocation, and test push. The reminders worker produces aquarium care, maintenance, medication, quarantine, water-test, metric-threshold, server-health/backup, and optional weekly Eddy alerts through the existing SES/console email provider plus VAPID Web Push. Setup and troubleshooting are documented in [`docs/operations/pwa-notifications.md`](docs/operations/pwa-notifications.md).

## Metrics And Graphing

Fluxpoint now includes a first-pass managed observability layer:

- Prometheus stores aquarium metric time series by scraping `GET /api/metrics/prometheus`.
- Grafana is provisioned as an internal Docker service with a Fluxpoint Prometheus datasource.
- Fluxpoint owns metric definitions, aquarium metric configs, hashed ingestion tokens, dashboard records, panel records, and sync logs.
- Aquarium pages expose a Metrics tab for latest readings, thresholds, Prometheus metric names, Grafana panel status, dashboard sync, and one-time token creation.
- `/metrics` shows backend status, metric definitions, active tokens, managed dashboards, and recent sync logs.
- Server Maintenance tracks app/server operational health independently from aquarium Prometheus/Grafana metrics.

Environment variables:

```bash
METRICS_ENABLED=true
METRICS_BACKEND=prometheus
GRAPH_BACKEND=grafana
PROMETHEUS_URL=http://prometheus:9090
GRAFANA_URL=http://grafana:3000
GRAFANA_PUBLIC_URL=
GRAFANA_EMBED_MODE=native
GRAFANA_ADMIN_USER=fluxpoint
GRAFANA_ADMIN_PASSWORD=change_me
GRAFANA_SERVICE_ACCOUNT_TOKEN=
ENABLE_METRICS_WORKER=true
```

Prometheus and Grafana are internal-only by default. Set `GRAFANA_PUBLIC_URL` and `GRAFANA_EMBED_MODE=iframe` only after you intentionally expose Grafana through a protected reverse proxy route. See `docs/metrics/prometheus-grafana.md` for the ingestion payload, metric naming conventions, Docker services, and security notes.

## Aquarium Operations Reference

- Aquarium volume is stored with an explicit gallon or liter unit. Existing records remain gallons. Medication planning converts the aquarium volume into the definition's gallon-or-liter dose basis before calculating a recommendation; keepers must still verify the product label.
- Species salinity is stored as a minimum/maximum range in parts per thousand. Habitat badges are derived from overlap with freshwater (through 0.5 ppt), brackish (above 0.5 and below 30 ppt), and marine (30 ppt and above) ranges.
- Default lighting capabilities are on/off, single-channel dimmer, RGB, and RGBW. RGB/RGBW schedules use their actual channels, while each set point's ramp is the transition time from the previous values. The chart derives overall intensity from the strongest channel and colors the curve from RGBW values.
- The default Compose deployment starts the server-metrics worker, which writes an initial snapshot and then follows `METRICS_WORKER_INTERVAL_MS`. Server Maintenance can also collect a snapshot immediately. A one-shot storage initializer creates and assigns runtime ownership for `public/uploads`, `public/labels`, `public/reports`, and `backups` before the app starts.
- Server administrators can inspect and disable users, reset credentials, edit/archive collections, and manage collection memberships from the linked Users and Collections cards in Server Maintenance. The active server administrator and collection-owner membership are protected.

## Current Limitations

- Authentication is credentials-based. Server administration, collection memberships, per-action role enforcement, and persistent active-collection switching are wired.
- QR codes and printable PDF label layouts are generated under `public/labels`; external printer integrations remain future work.
- Upload thumbnails are generated locally; optional object-storage media backends remain future work.
- Aquarium identities, cover photos, and task-based care schedules are implemented; broader care-project orchestration remains future work.
- Collection invitations use expiring setup tokens and enforce the multi-user collection role model.
- Lighting schedules are human-readable assignments only; no device control is wired.
- Recurring care scheduling is task-based and intentionally simple; no hardware/sensor triggers are wired.
- Raspberry Pi, Pico, ESP32 firmware, Grafana alerting, Alertmanager, species-derived thresholds, remote write, and Home Assistant integration are intentionally deferred.

## Roadmap

- Add optional object-storage media backends
- Add external printer integrations for generated QR/PDF labels
- Add broader care-project orchestration beyond task-based schedules
- Expand sensor/device pairing and hardware integrations around the Prometheus-backed metric layer
- Add collection-specific export packages alongside sitewide operational backups
- Add tests around server actions, domain helpers, and workflow transitions
