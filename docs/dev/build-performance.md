# Fluxpoint Build Performance

Fluxpoint keeps the production architecture intact: Caddy, Postgres, a migrate/bootstrap service, the standalone Next.js app, and worker containers. Build optimization focuses on avoiding duplicate app builds, preserving Docker cache layers, and keeping the build context small.

## Profiling Commands

Run these on the deployment host when diagnosing slow builds:

```bash
docker compose --progress=plain build
docker compose --progress=plain build app
./scripts/profile-build.sh
```

`scripts/profile-build.sh` writes raw output to `logs/build-YYYYMMDD-HHMMSS.log` and prints the total duration. The `logs/` directory is intentionally excluded from Docker build context.

## Current Findings

The slow paths to watch are:

- `npm ci`: should be cached by the `deps` stage and BuildKit `/root/.npm` cache mount unless `package.json` or `package-lock.json` changes.
- `npx prisma generate`: runs in the shared `source` stage used by both app and tools targets.
- `npm run build`: only runs in the `builder` target used by the app `runner`; migrate and workers use the `tools` target and do not run the Next production build.
- Docker context transfer: `.dockerignore` excludes local artifacts, uploads, labels, backups, logs, test reports, `.next`, `node_modules`, env files, and database files.
- Repeated worker builds: Compose services share the `fluxpoint-tools` image and `tools` target. Even when Compose lists multiple services, they point at the same target and should reuse BuildKit layers.

## Dockerfile Layout

- `base`: shared Node Alpine base with OpenSSL and CA certificates.
- `deps`: copies only package manifests and runs `npm ci` with a BuildKit npm cache mount.
- `source`: copies source, node modules, and runs `prisma generate`.
- `tools`: migration and worker image target; skips `next build`.
- `builder`: app build target; runs `npm run build` with a `.next/cache` cache mount.
- `runner`: standalone Next runtime image.

## Recommended Build Commands

For the app only:

```bash
npm run docker:build:app
```

For worker/migrate tools only:

```bash
npm run docker:build:workers
```

For a production build:

```bash
npm run docker:build:prod
```

For deploy/update:

```bash
./scripts/update-production.sh
```

## Safety Notes

Authenticated and database-backed App Router pages are marked dynamic so `next build` does not try to prerender them or connect to Postgres at build time. Marketing pages can remain static or dynamic as needed for runtime public environment values.

Do not remove Postgres, Caddy, the migration service, worker service definitions, standalone output, or root-relative app routing when optimizing build time.
