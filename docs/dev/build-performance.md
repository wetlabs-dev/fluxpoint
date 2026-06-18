# Fluxpoint Build Performance

Fluxpoint keeps the production architecture intact: Caddy, Postgres, a migrate/bootstrap service, the standalone Next.js app, and worker containers. Build optimization focuses on avoiding duplicate app builds, preserving Docker cache layers, and keeping the build context small.

## Profiling Commands

Run these on the deployment host when diagnosing slow builds:

```bash
./scripts/profile-next-build.sh
docker compose --progress=plain build
docker compose --progress=plain build app
./scripts/profile-build.sh
```

`scripts/profile-build.sh` writes raw output to `logs/build-YYYYMMDD-HHMMSS.log` and prints the total duration. The `logs/` directory is intentionally excluded from Docker build context.

`scripts/profile-next-build.sh` profiles the expensive app artifact steps directly:

- `time npx prisma generate`
- `time npm run build`
- `RUN_NEXT_PRIVATE_BUILD_WORKER=true ./scripts/profile-next-build.sh` also runs `NEXT_PRIVATE_BUILD_WORKER=1 npm run build`

It writes `logs/build-profile-YYYYMMDD-HHMMSS.log` and keeps the important Next phase lines together:

- creating optimized production build
- linting / type validity
- collecting page data
- generating static pages
- finalizing page optimization
- collecting build traces

## Current Findings

Comparison with AxilDB showed a few important differences:

- AxilDB's `npm run build` is a plain `next build`; Fluxpoint previously ran `prisma generate && next build`, even though the Docker `source` stage had already run `prisma generate`.
- AxilDB uses `serverExternalPackages` for heavy server-side PDF/font packages. Fluxpoint does not carry those PDF packages, but it now externalizes `nodemailer` and excludes uploads, labels, backups, logs, and test artifacts from standalone tracing.
- AxilDB's schema is larger than Fluxpoint's, so schema size is unlikely to explain a 109s Prisma generate by itself. Slow Prisma generation on the server is more likely to come from uncached engine work, slow disk, or repeated generate calls.
- Fluxpoint's attached slow build log showed Compose exporting and unpacking the same `fluxpoint-tools` target once per worker/migrate service. That repeated image export was the dominant cost, not just Next itself.
- Fluxpoint has far fewer App Router routes than AxilDB. All authenticated/database-backed Fluxpoint routes are marked `force-dynamic`, including the authenticated app layout, so `next build` should not query Postgres during prerender.

Profile evidence:

- Attached production log before this optimization: full `docker compose up -d --build` took about 2870s; app `npm run build` took about 2037s; each tools-target service spent roughly 2814-2829s exporting/unpacking the same `fluxpoint-tools` image.
- Local profile after this optimization on 2026-06-18: `npx prisma generate` took 2s, and `npm run build` took 15s. The local build only generated 4 static pages; authenticated app routes stayed dynamic.

The slow paths to watch are now:

- `npm ci`: should be cached by the `deps` stage and BuildKit `/root/.npm` cache mount unless `package.json` or `package-lock.json` changes.
- `npx prisma generate`: runs once in the shared Docker `source` stage used by both app and tools targets, with a BuildKit `/root/.cache/prisma` cache mount. `npm run build` no longer runs Prisma generate again.
- `npm run build`: now runs only `next build`. Strict typechecking and generation happen in `npm run check:production`.
- Docker context transfer: `.dockerignore` excludes local artifacts, uploads, labels, backups, logs, test reports, `.next`, `node_modules`, env files, and database files.
- Repeated worker builds: only `migrate` declares the `tools` build target. Reminder, metrics, backup, and AI worker services reuse the same `fluxpoint-tools` image, preventing Compose from exporting the same image repeatedly during `docker compose up -d --build`.

## Exit 137 During npm ci

If the build fails at `RUN --mount=type=cache,target=/root/.npm npm ci` with exit code `137`, the dependency install was killed by the host, usually due to memory pressure. That is distinct from the earlier slow Next build/tracing issue.

The Dockerfile disables npm audit, funding, update-notifier, and progress output during image builds:

```bash
npm ci --no-audit --no-fund --prefer-offline --progress=false
```

If a small production host still kills `npm ci`, add temporary swap on the host or build the image on a larger machine/CI runner and deploy the resulting image. The app-only fast path remains:

```bash
docker compose build app
docker compose up -d --no-deps app
```

## Dockerfile Layout

- `base`: shared Node Alpine base with OpenSSL and CA certificates.
- `deps`: copies only package manifests and runs `npm ci` with a BuildKit npm cache mount.
- `source`: copies source, node modules, and runs `prisma generate` once with a Prisma cache mount.
- `tools`: migration and worker image target; skips `next build`.
- `builder`: app build target; runs `npm run build` with a `.next/cache` cache mount.
- `runner`: standalone Next runtime image.

## Recommended Build Commands

For the app only:

```bash
npm run docker:build:app
./scripts/rebuild-app.sh
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

For the fastest normal app-only update on a server that already has a healthy database and migrations applied:

```bash
./scripts/update-app-fast.sh
```

That script runs:

```bash
git pull --ff-only
docker compose build app
docker compose up -d --no-deps app
```

Use this for code-only app rebuilds when no migration needs to run. Use the full update path when Prisma migrations, bootstrap behavior, worker code, or Compose configuration changed.

## Safety Notes

Authenticated and database-backed App Router pages are marked dynamic so `next build` does not try to prerender them or connect to Postgres at build time. Marketing pages can remain static or dynamic as needed for runtime public environment values.

Run `npm run check:production` before production deployment in CI or a prepared local checkout. Docker image creation intentionally focuses on the production artifact; it should not be the only safety gate.

Do not remove Postgres, Caddy, the migration service, worker service definitions, standalone output, or root-relative app routing when optimizing build time.
