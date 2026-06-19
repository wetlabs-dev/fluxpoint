# Fluxpoint Build Performance

Fluxpoint keeps the production architecture intact: Caddy, Postgres, a migrate/bootstrap service, the standalone Next.js app, Prometheus/Grafana, and optional worker containers. Build optimization focuses on avoiding duplicate app builds, preserving Docker cache layers, keeping the build context small, and preventing a large tools image from being exported during routine app updates.

## Profiling Commands

Run these on the deployment host when diagnosing slow builds:

```bash
./scripts/profile-next-build.sh
docker compose --progress=plain build
docker compose --progress=plain build app
./scripts/profile-build.sh
./scripts/report-image-sizes.sh
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

Comparison with AxilDB and the slow Fluxpoint production logs showed a few important differences:

- AxilDB does not have Fluxpoint's `deploy-fast.sh` helper in the compared checkout. Fluxpoint's helper was the immediate problem in the latest log: `git pull` reported `Already up to date`, but the script still forced `docker compose build app`, so a no-op deploy paid for `npm ci`, Prisma generation, and `next build` anyway.
- AxilDB's `npm run build` is a plain `next build`; Fluxpoint previously ran `prisma generate && next build`, even though the Docker `source` stage had already run `prisma generate`.
- AxilDB uses `serverExternalPackages` for heavy server-side PDF/font packages. Fluxpoint does not carry those PDF packages, but it now externalizes `nodemailer` and excludes uploads, labels, backups, logs, and test artifacts from standalone tracing.
- AxilDB's schema is larger than Fluxpoint's, so schema size is unlikely to explain a 109s Prisma generate by itself. Slow Prisma generation on the server is more likely to come from uncached engine work, slow disk, or repeated generate calls.
- Fluxpoint's attached slow build logs showed `npm ci` around 617s, `COPY node_modules` around 418s, Prisma generate around 125s, `npm run build` around 2098s, `fluxpoint-tools` export around 2365s, and `fluxpoint-tools` unpacking around 431s. The previous `tools` target inherited the full source stage, so it carried app source and any copied artifacts that tools/workers did not need.
- Worker services were in the default Compose profile. Even when disabled by environment variables, they could still participate in full `docker compose up -d --build` workflows.
- Fluxpoint has far fewer App Router routes than AxilDB. All authenticated/database-backed Fluxpoint routes are marked `force-dynamic`, including the authenticated app layout, so `next build` should not query Postgres during prerender.

Profile evidence:

- Attached production log before this optimization: full `docker compose up -d --build` took about 2870s; app `npm run build` took about 2037s; each tools-target service spent roughly 2814-2829s exporting/unpacking the same `fluxpoint-tools` image.
- Local profile after this optimization on 2026-06-18: `npx prisma generate` took 2s, and `npm run build` took 15s. The local build only generated 4 static pages; authenticated app routes stayed dynamic.
- Attached production log on 2026-06-19: `./scripts/update-production.sh` reported `Already up to date` but still rebuilt both `app` and `migrate`, taking about 4665s. The expensive sections were `npm ci` at 694s, app `npm run build` at 1618s, `COPY --from=prisma-client /app/node_modules` into tools at 426s, and `fluxpoint-tools` export/unpack at 2341s.
- Local profile after the 2026-06-19 tools-image change: `docker compose build migrate` completed in about 24s. The new minimal tools dependency install took about 12s, Prisma generation took about 1s, and tools export/unpack took about 6s. `docker compose build app` completed locally with cached npm install in about 30s, with Next build around 17s.

Current optimization decisions:

- `deploy-fast.sh` and `update-app-fast.sh` now compare `HEAD` before/after `git pull`. If no new commit was pulled and the `fluxpoint-app` image already exists, they skip `docker compose build app` and only recreate/start the app container with the existing image. Set `FORCE_REBUILD=true ./scripts/deploy-fast.sh` when you intentionally want to rebuild anyway.
- `deploy-full.sh` and `update-production.sh` now compare `HEAD` before/after `git pull`. If no new commit was pulled and `fluxpoint-app` exists, they skip image rebuilds and only run `docker compose up -d`. If a new commit was pulled, they inspect changed files: Prisma, dependency, Docker/Compose, script, `src/domains`, or `src/lib` changes trigger an app+migrate build; page/component-only changes build and restart only the app.
- `tools` no longer inherits the full app dependency stage or full app source stage. It installs a small runtime/tooling dependency set for Prisma, TSX workers, email/date utilities, env loading, and validation; then it copies only package files, `tsconfig.json`, Prisma schema/migrations, `scripts`, `src/domains`, and `src/lib`.
- `prisma-client` generates Prisma after copying only package manifests and `prisma/`. Normal UI/page changes no longer invalidate Prisma generation; schema or dependency changes still do.
- The Docker `builder` stage sets `NEXT_SKIP_BUILD_CHECKS=true`, which tells Next to skip duplicate TypeScript/lint checks during image artifact creation. `npm run check:production` remains strict and must run in CI or a prepared checkout before deployment.
- Worker services use the `workers` Compose profile and are not part of the default `docker compose up -d` service set.
- `docker compose build app` does not build or export `fluxpoint-tools`.
- `docker compose up -d --no-deps --build app` is the emergency one-liner for app-only rebuilds when dependencies and migrations are unchanged.
- `productionBrowserSourceMaps` is disabled, and output tracing excludes local caches, logs, backups, uploads, labels, docs media, test output, and build profiles.

The slow paths to watch are now:

- `npm ci`: should be cached by the `deps` stage and BuildKit `/root/.npm` cache mount unless `package.json` or `package-lock.json` changes.
- `COPY --from=deps /app/node_modules ./node_modules`: still happens for the app build because Next needs the full dependency tree. The tools target no longer copies that tree; it copies the smaller `tools-deps` dependency set instead.
- `npx prisma generate`: runs in the `prisma-client` stage, with a BuildKit `/root/.cache/prisma` cache mount. It is reused by app and tools targets, and normal source-only changes do not rerun it.
- `npm run build`: now runs only `next build`. Strict typechecking and generation happen in `npm run check:production`. Docker sets `NEXT_SKIP_BUILD_CHECKS=true` so Next does not repeat TypeScript/lint validation after the safety gate.
- Docker context transfer: `.dockerignore` excludes local artifacts, uploads, labels, backups, logs, test reports, `.next`, `node_modules`, env files, and database files.
- Repeated worker builds: optional workers are behind the `workers` profile. Use `docker compose --profile workers up -d` only when those processes should run.

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
- `tools-deps`: installs only the packages needed for Prisma migrations, TSX scripts/workers, email/date helpers, env loading, and shared runtime validation.
- `prisma-client`: copies package manifests and Prisma files, then runs `prisma generate`.
- `app-source`: copies generated dependencies plus the full app source.
- `tools`: copies the small `tools-deps` dependency tree plus only package files, `tsconfig.json`, Prisma, scripts, `src/domains`, and `src/lib`; skips `next build` and never includes `.next` or the full app dependency tree.
- `builder`: app build target based on `app-source`; runs `npm run build` with a `.next/cache` cache mount.
- `runner`: standalone Next runtime image.

## Recommended Build Commands

For the app only:

```bash
npm run docker:build:app
./scripts/rebuild-app.sh
./scripts/deploy-fast.sh
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
./scripts/deploy-full.sh
```

For the fastest normal app-only update on a server that already has a healthy database and migrations applied:

```bash
./scripts/update-app-fast.sh
```

That script runs:

```bash
git pull --ff-only
docker compose build app # skipped when git pulled no new commit and fluxpoint-app exists
docker compose up -d --no-deps app
```

Use this for code-only app rebuilds when no migration needs to run. Use the full update path when Prisma migrations, bootstrap behavior, worker code, or Compose configuration changed. To force a rebuild even when `git pull` is already current, run:

```bash
FORCE_REBUILD=true ./scripts/deploy-fast.sh
```

Do not use `docker compose up -d --build` as the normal update command. It is convenient, but on small production hosts it can rebuild and export more than intended. Prefer:

```bash
./scripts/deploy-fast.sh
```

or, when migrations changed:

```bash
./scripts/deploy-full.sh
```

Run workers explicitly when needed:

```bash
docker compose --profile workers up -d
```

To inspect image sizes after a build:

```bash
./scripts/report-image-sizes.sh
docker images | grep fluxpoint
docker history fluxpoint-tools
docker history fluxpoint-app
```

## Safety Notes

Authenticated and database-backed App Router pages are marked dynamic so `next build` does not try to prerender them or connect to Postgres at build time. Marketing pages can remain static or dynamic as needed for runtime public environment values.

Run `npm run check:production` before production deployment in CI or a prepared local checkout. Docker image creation intentionally focuses on the production artifact; it should not be the only safety gate.

Do not remove Postgres, Caddy, the migration service, worker service definitions, standalone output, or root-relative app routing when optimizing build time.
