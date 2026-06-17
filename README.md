# Fluxpoint

Fluxpoint is a modern, cozy aquarium management system for tracking tanks, livestock, plants, hardscape, equipment, husbandry, water parameters, workflows, QR labels, audit history, and AI-assisted naming and cover-card ideas.

The first version is built as a serious long-term application foundation, not a throwaway prototype. It uses a dashboard-first Next.js App Router UI, Prisma domain models, reusable components, typed validation, server actions, and clean service boundaries for future AI, metrics, QR, and audit features.

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

- `https://wetlabs.dev/fluxpoint` is the splash page / marketing page.
- `https://fluxpoint.wetlabs.dev` is the canonical Fluxpoint app.
- The app should not be deployed with a Next.js `basePath` of `/fluxpoint`.
- App routes stay root-relative on the app subdomain: `/dashboard`, `/aquariums`, `/inventory`, `/equipment`, `/workflows`, and `/settings`.
- Local development still runs normally at `http://localhost:3000`, with the marketing preview available at `/marketing-preview`.

Required environment variables:

```bash
NEXT_PUBLIC_APP_URL="https://fluxpoint.wetlabs.dev"
NEXT_PUBLIC_MARKETING_URL="https://wetlabs.dev/fluxpoint"
NEXT_PUBLIC_SITE_NAME="Fluxpoint"
```

Suggested hosting setup:

- Route `wetlabs.dev/fluxpoint` to the portable marketing page component at `src/components/marketing/FluxpointSplashPage.tsx`.
- Proxy `fluxpoint.wetlabs.dev` to the Fluxpoint Next.js app.
- Keep canonical metadata, Open Graph URLs, app launch CTAs, and cross-links sourced from the environment variables above.

## Docker-First Production Deployment

Production deployment support lives in [`docs/deployment/docker-compose-caddy-postgres.md`](docs/deployment/docker-compose-caddy-postgres.md). Fluxpoint follows the AxilDB-style Compose architecture:

- `caddy`: Dockerized public edge proxy on ports 80/443 with Let's Encrypt-managed certificates
- `db`: Postgres 16 persisted in the `fluxpoint_pgdata` Docker volume
- `migrate`: one-shot Prisma migration and safe bootstrap service
- `app`: standalone Next.js server on the internal Compose network at port 3000
- `reminders`, `metrics`, `backups`, `ai-worker`: prepared worker containers with safe placeholder behavior

The app port is not exposed directly to the public host. Caddy proxies `fluxpoint.wetlabs.dev` to `app:3000`. The marketing URL remains separate at `wetlabs.dev/fluxpoint`.

## Architecture Philosophy

Fluxpoint separates definition records from instance records. `SpeciesDefinition` describes what a species is, while `AquariumItem` records the actual fish, plant, hardscape, equipment, food, medication, or additive in the collection. Movement is generic: `ItemTransfer` can move any item between tanks or storage.

Aquariums own the operational timeline through `AquariumEvent`, current and historic readings through `WaterParameterReading`, workflow runs through `WorkflowRun`, and AI concepts through `AiSuggestion`. Equipment is an item with an optional `EquipmentProfile`, which keeps the inventory model flexible while still supporting maintenance due indicators.

The application is organized around durable domains:

- `src/domains/aquariums` for tank actions and metadata workflows
- `src/domains/ai` for provider-ready mock AI services
- `src/domains/audit` for audit logging helpers
- `src/domains/qr` for QR payload and placeholder label generation
- `src/lib/db`, `src/lib/validation`, and `src/lib/design` for shared infrastructure

## Included First-Version Surfaces

- `/dashboard`: illustrated tank dashboard with seeded tanks Driftlake, Sunstream, Springhollow, Mossglow, Rockmere, and Duskbrook
- `/aquariums`: aquarium list and create form
- `/aquariums/[id]`: overview, stocking/items, equipment, parameters, events, workflows, and AI Studio panels
- `/inventory`: collection-wide item list with type filters and transfer affordance
- `/equipment`: equipment list with maintenance due indicators
- `/workflows`: starter workflow templates
- `/settings`: collection settings and future server management placeholders
- `/api/qr/[entityType]/[entityId]`: QR payload placeholder endpoint

## AI Studio

The AI Studio currently uses local mock data through `src/domains/ai/ai-service.ts`.

Prepared functions:

- `generateTankNames(input)`
- `generateCoverCardConcepts(input)`
- `generateCareAdvice(input)`

Selected tank names and cover card concepts are persisted as `AiSuggestion` records and can update `Aquarium.generatedName` and `Aquarium.coverCardStyle`.

## Roadmap

- Add authentication and user invitation flows
- Add full item transfer forms and transfer history views
- Add media upload and photo records
- Add real QR label rendering and print layouts
- Wire AI service boundaries to an OpenAI provider
- Add workflow execution screens and recurring task scheduling
- Add sensor ingestion and Prometheus-backed metric views
- Add backup/export and server health management
- Add tests around server actions, domain helpers, and workflow transitions
