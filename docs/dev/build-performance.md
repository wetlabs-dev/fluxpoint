# Fluxpoint Build Performance

Fluxpoint uses one production deployment path:

```bash
git pull --ff-only
docker compose up -d --build
```

No deploy wrapper decides which services to build. Docker Compose and BuildKit own cache reuse.

## Production Evidence

The slow June 19 production run was interrupted after about 1,535 seconds, before the Next build completed. Most elapsed time was not application compilation:

- full app `npm ci`: about 789 seconds
- separate tools dependency install: about 537 seconds
- copying the tools dependency tree: about 185 seconds
- Prisma generation in the tools image: about 130 seconds
- tools image export was still running after about 409 seconds

The app and migration paths had separate dependency trees. A `package.json` change that added only an npm check script invalidated the full app dependency install, while broad `scripts/`, `src/domains/`, and `src/lib/` copies invalidated the migration/tools image.

AxilDB is faster largely because its ordinary Compose graph shares a conventional cached dependency/build path and does not use Fluxpoint's custom deployment-script classification. Fluxpoint cannot copy AxilDB's builder image directly because Fluxpoint's optional workers and bootstrap need TSX source at runtime, but those tools do not belong in every app deployment.

## Current Build Graph

- `deps`: creates a dependency-only `package.json` from `package-lock.json`, then runs `npm ci`. Changes to npm scripts or package metadata no longer invalidate this layer.
- `prisma-client`: generates Prisma Client only when the lockfile or `prisma/` changes.
- `builder`: runs the standalone Next.js build with a persistent BuildKit `.next/cache` mount.
- `runner`: contains only the standalone server, static/public assets, and required Prisma runtime files.
- `migrate`: installs only the locked Prisma CLI and copies only `prisma/`. It does not generate Prisma Client, copy app source, run bootstrap, or build Next.js.
- `tools`: remains available for explicit bootstrap and optional workers, but is outside the default Compose profile.

For a normal source-only update, BuildKit should show the dependency, Prisma Client, and migration stages as `CACHED`. The variable work should be the source copy, incremental Next build, and app runner export.

The first build after this Dockerfile change must create the new cache layers. That first run is not representative of later source-only deployments.

## Bootstrap And Workers

Bootstrap is explicit because it is setup/data work, not a schema migration. Run it once after the first deployment:

```bash
docker compose --profile bootstrap run --rm --build bootstrap
```

Optional workers reuse the tools image. Build the tools image only when bootstrap or worker code/dependencies change:

```bash
docker compose --profile bootstrap build bootstrap
docker compose --profile workers up -d
```

Neither profile participates in the default `docker compose up -d --build` graph.

## Profiling

Capture a full Compose build log with:

```bash
./scripts/profile-build.sh
```

Profile Prisma and Next phases directly with:

```bash
./scripts/profile-next-build.sh
```

Both scripts write timestamped files under `logs/`, which is excluded from the Docker build context.

During a second source-only build, investigate any of these unexpected results:

- `deps` runs `npm ci`: `package-lock.json` changed or the builder cache was deleted.
- `migrate-deps` installs Prisma: `package-lock.json` or the Dockerfile changed, or the builder cache was deleted.
- `prisma-client` runs `prisma generate`: `prisma/`, the lockfile, or its parent layer changed.
- `tools` appears at all: a non-default Compose profile was enabled.

## Safety

Authenticated/database-backed routes remain dynamic so `next build` does not query production services during prerender. Docker artifact creation skips duplicate lint/type checks; run `npm run check:production` in CI or a prepared checkout before deployment.

The architecture remains Caddy, Postgres, a safe one-shot migration gate, standalone Next.js, Prometheus/Grafana, and optional worker containers.
