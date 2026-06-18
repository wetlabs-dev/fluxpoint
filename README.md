# Fluxpoint

Fluxpoint is a modern, cozy aquarium management system for tracking tanks, livestock, plants, hardscape, equipment, husbandry, water parameters, workflows, QR labels, audit history, and AI-assisted naming and cover-card ideas.

The first version is built as a serious long-term application foundation, not a throwaway prototype. It uses a dashboard-first Next.js App Router UI, Prisma domain models, reusable components, typed validation, server actions, and clean service boundaries for future AI, metrics, QR, and audit features.

Design notes live in [`docs/design/typography.md`](docs/design/typography.md) and [`docs/design/theme.md`](docs/design/theme.md).

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

Open `http://localhost:3000/dashboard`.

For local preview of the portable marketing page, open `http://localhost:3000/marketing-preview`.

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

Protected app routes redirect unauthenticated users to `/login`. Public routes include `/fluxpoint`, `/marketing-preview`, `/api/health`, and `/api/ready`.

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

- `https://www.wetlabs.dev/fluxpoint` is the splash page / marketing page.
- `https://fluxpoint.wetlabs.dev` is the canonical Fluxpoint app.
- The app should not be deployed with a Next.js `basePath` of `/fluxpoint`.
- App routes stay root-relative on the app subdomain: `/dashboard`, `/aquariums`, `/inventory`, `/equipment`, `/workflows`, and `/settings`.
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
ADMIN_EMAIL="you@example.com"
ADMIN_PASSWORD="use-a-long-unique-password"
AI_ENABLED="true"
AI_PROVIDER="mock"
OPENAI_API_KEY=""
EMAIL_ENABLED="false"
EMAIL_PROVIDER="console"
EMAIL_DELIVERY_MODE="log"
APP_EMAIL_FROM="Fluxpoint <no-reply@wetlabs.dev>"
```

Suggested hosting setup:

- Route `www.wetlabs.dev/fluxpoint` to the portable marketing page component at `src/components/marketing/FluxpointSplashPage.tsx`.
- Proxy `fluxpoint.wetlabs.dev` to the Fluxpoint Next.js app.
- Keep canonical metadata, Open Graph URLs, app launch CTAs, and cross-links sourced from the environment variables above.
- This repo exposes `/fluxpoint` and `/marketing-preview` without moving app routes under `/fluxpoint`.

## Docker-First Production Deployment

Production deployment support lives in [`docs/deployment/docker-compose-caddy-postgres.md`](docs/deployment/docker-compose-caddy-postgres.md). Fluxpoint follows a Docker Compose production architecture:

- `caddy`: Dockerized public edge proxy on ports 80/443 with Let's Encrypt-managed certificates
- `db`: Postgres 16 persisted in the `fluxpoint_pgdata` Docker volume
- `migrate`: one-shot Prisma migration and safe bootstrap service
- `app`: standalone Next.js server on the internal Compose network at port 3000
- `reminders`, `metrics`, `backups`, `ai-worker`: worker containers; reminders can send idempotent due-care emails when enabled

The app port is not exposed directly to the public host. Caddy proxies `fluxpoint.wetlabs.dev` to `app:3000`. The marketing URL remains separate at `www.wetlabs.dev/fluxpoint`.

Docker readiness uses `/api/ready`, which verifies that the Next.js server is responding. `/api/health` remains the database-aware health endpoint for deeper checks after the stack is online.

### Faster Docker Builds

Build performance notes live in [`docs/dev/build-performance.md`](docs/dev/build-performance.md). Useful commands:

```bash
npm run docker:build:app
npm run docker:build:workers
npm run docker:build:prod
npm run docker:up:build
./scripts/profile-build.sh
./scripts/update-production.sh
```

The Dockerfile uses BuildKit cache mounts for npm and Next build cache. Migrate and worker containers use the `tools` target, which skips the expensive Next production build; only the app runner target builds the standalone Next server.

## Architecture Philosophy

Fluxpoint separates definition records from instance records. `SpeciesDefinition` describes what a species is, while `AquariumItem` records the actual fish, plant, hardscape, equipment, food, medication, or additive in the collection. Movement is generic: `ItemTransfer` can move any item between tanks or storage.

Aquariums own the operating workspace: the timeline through `AquariumEvent`, current and historic readings through `WaterParameterReading`, recurring care through `CareSchedule` and `CareTask`, workflow runs through `WorkflowRun`, lighting assignments through `AquariumLightingAssignment`, QR payloads through `QrCode`, and AI concepts through `AiSuggestion`. Equipment is an item with an optional `EquipmentProfile`, which keeps the inventory model flexible while still supporting maintenance due indicators.

The application is organized around durable domains:

- `src/domains/aquariums` for tank actions and metadata workflows
- `src/domains/ai` for provider-ready mock/OpenAI services, moderation, and request logging
- `src/domains/email` for console/SES-compatible SMTP delivery, templates, and email logging
- `src/domains/audit` for audit logging helpers
- `src/domains/qr` for QR payload and placeholder label generation
- `src/lib/db`, `src/lib/validation`, and `src/lib/design` for shared infrastructure

## Working App Surfaces

- `/login`: credentials login for the bootstrapped admin user
- `/dashboard`: database-backed tank dashboard with active tank cards, recent activity, tracked item/event counts, equipment due count, and simple parameter alerts
- `/aquariums`: collection-scoped aquarium list and create form
- `/aquariums/[id]`: primary tank workspace with Overview, Livestock, Plants, Equipment, Parameters, Timeline, Maintenance, AI Studio, and QR / Labels sections
- `/schedules`: recurring care schedules and generated care tasks for feeding, testing, water changes, maintenance, dosing, and equipment service
- `/species`: species definition library with category/search filters, derived scientific names, type-aware guidance, create/edit, and delete protection when in use
- `/inventory`: item list with type/location/search filters, type-aware item categories, source/purchase metadata, create, archive, and generic transfer actions
- `/equipment`: equipment records using `AquariumItem` plus `EquipmentProfile`, maintenance due status, mark-maintained action, source/purchase metadata, and item QR payload generation
- `/workflows`: seeded workflow templates and collection run counts
- `/settings`: account, collection, appearance, location/source management, lighting schedule management, and honest server health state
- `/api/qr/[entityType]/[entityId]`: QR payload placeholder endpoint

## Aquarium Workspace

`/aquariums/[id]` is the primary daily-use surface. It keeps tank identity, structured location, selected substrate, selected light, lighting schedule, latest readings, recent timeline events, and quick actions visible before the user dives into specific sections.

Timeline events are first-class records. `EventCreateForm`, `TimelineList`, `TimelineItem`, and `EventTypeBadge` render reusable event flows for notes, feeding, water changes, test results, maintenance, medication, stocking, deaths, spawns, photos, equipment changes, transfers, and other observations. Events can point at a related item, and test-result events create matching `WaterParameterReading` rows.

Parameter logging supports multi-reading entry for temperature, pH, ammonia, nitrite, nitrate, GH, KH, TDS, turbidity, CO2, light, and water level. The workspace shows latest value cards, a recent readings table, and a reserved chart area for a future visualization layer.

Maintenance logging is intentionally simple: a maintenance event can store type, optional water-change percent, optional water-change gallons, summary, and notes. Feeding logs create `FEEDING` events and can link to inventory items with item type `FOOD`.

Care schedules generate practical `CareTask` records for daily, weekly, monthly, and every-N-days cadences. Completing or skipping a task advances the schedule and creates the next task. Completion can create a timeline event for aquarium-scoped tasks. Custom recurrence is intentionally a placeholder rather than an RRULE implementation.

Lighting schedules are modeled with `LightingSchedule`, `LightingSchedulePoint`, and `AquariumLightingAssignment`. Settings can create a three-point starter schedule, and the aquarium workspace can assign a schedule and light item to a tank. Device control is not implemented yet.

QR generation stores stable payloads such as `fluxpoint://aquarium/{id}` and `fluxpoint://item/{id}`. QR images and PDF labels remain future work.

## AI And Email Integration

The AI Studio uses `src/domains/ai/ai-service.ts` as the provider boundary. `AI_PROVIDER=mock` is the local-safe default. Set `AI_PROVIDER=openai` and `OPENAI_API_KEY` to enable live OpenAI calls. If OpenAI is selected without a key, Fluxpoint falls back to mock and surfaces that state in Settings.

Supported AI functions:

- `generateTankNames(input)`
- `generateCoverCardConcepts(input)`
- `generateCareAdvice(input)`
- `generateTroubleshootingQuestions(input)`
- `summarizeAquariumStatus(input)`
- `generateTankCoverImage(input)`
- `moderateText(input)`
- `moderateImage(input)`

AI requests are persisted in `AiRequestLog`; moderation checks are persisted in `ModerationReview`. Generated cover images are written under `public/uploads/ai` and only the URL/filename is stored in the database.

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

All sends create `EmailLog` rows. Password reset, collection invitation, and care reminder templates render both HTML and text. The reminders worker checks `EmailLog` before sending so the same due task is not emailed repeatedly during restarts.

## Current Limitations

- Authentication is credentials-based and single-tenant by default; password reset is wired, while full multi-user collection role enforcement is still future work.
- QR support stores and displays payloads, but does not render QR images until a QR rendering package is selected.
- PDF/print label generation is not implemented yet; generated labels should eventually live under `public/labels`.
- Media uploads are not implemented yet; local uploads should use `public/uploads` and remain Docker bind-mount compatible.
- Aquarium identities/cover-card records and care projects remain future schema work.
- Collection invitations can be sent and logged, but acceptance remains lightweight until the multi-user role model is fully enforced.
- Lighting schedules are human-readable assignments only; no device control is wired.
- Recurring care scheduling is task-based and intentionally simple; no hardware/sensor triggers are wired.
- Collection switching is not implemented; Fluxpoint uses the logged-in user’s first/default collection.
- Sensor architecture, Prometheus, Grafana, Raspberry Pi, Pico, ESP32, API keys, and live ingestion are intentionally deferred.

## Roadmap

- Add authentication and user invitation flows
- Add full item transfer forms and transfer history views
- Add media upload and photo records
- Add real QR label rendering and print layouts
- Wire AI service boundaries to an OpenAI provider
- Add care projects, aquarium identity records, and collection sharing
- Add workflow execution screens beyond current task completion
- Add sensor ingestion and Prometheus-backed metric views in a separate architecture pass
- Add backup/export and server health management
- Add tests around server actions, domain helpers, and workflow transitions
