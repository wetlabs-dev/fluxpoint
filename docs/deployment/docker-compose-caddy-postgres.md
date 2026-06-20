# Fluxpoint Docker Compose Deployment

Fluxpoint production is Docker-first: Caddy at the edge, Postgres as the primary database, Prometheus and Grafana for internal metrics graphing, a one-shot migration service, a standalone Next.js app container, and optional bootstrap/worker tooling.

Canonical URLs:

- App: `https://fluxpoint.wetlabs.dev`
- Marketing/splash: `https://www.wetlabs.dev/fluxpoint`

Important routing rules:

- Do not set a Next.js `basePath`.
- The app does not live under `/fluxpoint`.
- App routes remain root-relative on `fluxpoint.wetlabs.dev`, for example `/dashboard`.
- `www.wetlabs.dev/fluxpoint` is an edge route to the Fluxpoint splash page, not a prefix for app dashboard routes.

## Architecture

- `caddy`: public reverse proxy on host ports `80` and `443`, with Caddy-managed Let's Encrypt certificates persisted in Docker volumes.
- `db`: Postgres 16 with data persisted in `fluxpoint_pgdata`.
- `migrate`: small one-shot Prisma migration container. It waits for Postgres health and runs `prisma migrate deploy` without building Next.js, generating Prisma Client, or copying application source.
- `bootstrap`: optional one-time setup container in the `bootstrap` profile. It creates the initial admin and starter records only when explicitly run.
- `app`: standalone Next.js production server on internal port `3000`. It depends on healthy Postgres and successful migrations.
- `prometheus`: optional internal service in the `observability` profile that scrapes `app:3000/api/metrics/prometheus`.
- `grafana`: optional internal service in the `observability` profile with Fluxpoint Prometheus datasource provisioning.
- `reminders`: optional recurring care reminder worker in the `workers` Compose profile.
- `metrics`: optional backend health/dashboard sync worker for Fluxpoint-managed metrics in the `workers` Compose profile.
- `backups`: optional queued backup worker in the `workers` Compose profile.
- `ai-worker`: optional future AI/image analysis worker in the `workers` Compose profile.

Persistent storage:

- `fluxpoint_pgdata:/var/lib/postgresql/data`
- `fluxpoint_prometheus_data:/prometheus`
- `fluxpoint_grafana_data:/var/lib/grafana`
- `caddy_data:/data`
- `caddy_config:/config`
- `./public/uploads:/app/public/uploads`
- `./public/labels:/app/public/labels`
- `./backups:/app/backups`

No separate app-level systemd unit is needed. Docker restart policies keep the services running, and Docker itself should be enabled at boot.

## Install Docker On Ubuntu

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg git
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable docker
sudo systemctl start docker
```

## Clone Fluxpoint

```bash
sudo mkdir -p /var/www
sudo git clone https://github.com/wetlabs-dev/fluxpoint.git /var/www/fluxpoint
cd /var/www/fluxpoint
```

## Configure Environment

```bash
sudo cp .env.production.example .env.production
sudo nano .env.production
```

Minimum production values:

```bash
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0

NEXT_PUBLIC_APP_URL=https://fluxpoint.wetlabs.dev
NEXT_PUBLIC_MARKETING_URL=https://www.wetlabs.dev/fluxpoint
NEXT_PUBLIC_SITE_NAME=Fluxpoint
NEXT_PUBLIC_DONATE_URL=https://ko-fi.com/wetlabs
NEXT_PUBLIC_GITHUB_URL=https://github.com/wetlabs-dev/fluxpoint
NEXTAUTH_URL=https://fluxpoint.wetlabs.dev
AUTH_SECRET=replace_with_a_long_random_secret
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=replace_with_a_long_unique_password

POSTGRES_DB=fluxpoint
POSTGRES_USER=fluxpoint
POSTGRES_PASSWORD=change_me

DATABASE_URL=postgresql://fluxpoint:change_me@db:5432/fluxpoint?schema=public

ENABLE_REMINDERS_WORKER=false
ENABLE_METRICS_WORKER=false
ENABLE_BACKUPS_WORKER=false
ENABLE_AI_WORKER=false

METRICS_ENABLED=true
METRICS_BACKEND=prometheus
GRAPH_BACKEND=grafana
PROMETHEUS_URL=http://prometheus:9090
GRAFANA_URL=http://grafana:3000
GRAFANA_PUBLIC_URL=
GRAFANA_EMBED_MODE=native
GRAFANA_ADMIN_USER=fluxpoint
GRAFANA_ADMIN_PASSWORD=replace_with_a_long_unique_password
GRAFANA_SERVICE_ACCOUNT_TOKEN=
GF_SECURITY_ADMIN_USER=fluxpoint
GF_SECURITY_ADMIN_PASSWORD=replace_with_a_long_unique_password
GF_SECURITY_ALLOW_EMBEDDING=true
GF_AUTH_ANONYMOUS_ENABLED=false
```

Use a strong `POSTGRES_PASSWORD` and make sure `DATABASE_URL` uses the same value.
Prometheus and Grafana are Docker-internal by default; do not add a public Grafana route unless it is intentionally protected.

## Create Bind-Mount Directories

```bash
mkdir -p public/uploads public/labels backups
```

The app container runs as UID/GID `1001`, so set writable ownership if needed:

```bash
sudo chown -R 1001:1001 public/uploads public/labels backups
```

## DNS Requirements

- `fluxpoint.wetlabs.dev` A/AAAA points to this server.
- `www.wetlabs.dev` remains handled by the existing site unless you intentionally route `/fluxpoint` to a marketing service.
- Host ports `80` and `443` must be reachable for Caddy and Let's Encrypt.

## Build And Start

For every normal deploy, including deploys with Prisma migrations:

```bash
git pull --ff-only
docker compose up -d --build
docker compose ps
```

Docker checks the lean default graph (`db`, `migrate`, `app`, and `caddy`), reuses cached image layers, runs pending migrations, and starts the app only after migration success. Only `migrate` and `app` have build definitions in this graph. Caddy and Postgres use official images. The migration image is independent of normal source and `package.json` script changes, so it remains cached until Prisma itself or `prisma/` changes.

On the first deployment only, bootstrap the initial admin and starter records after the stack is healthy:

```bash
docker compose --profile bootstrap run --rm --build bootstrap
```

Run bootstrap again only when its idempotent starter-data behavior is intentionally needed. To run only migrations:

```bash
docker compose run --rm migrate
```

Optional workers are not started by the default Compose profile. Start them explicitly only when you want them running:

```bash
docker compose --profile workers up -d --build
```

The workers profile builds the tools target once through `reminders`; `metrics`, `backups`, and `ai-worker` reuse the resulting image. Start the optional metrics stack independently when needed:

```bash
docker compose --profile observability up -d --build
```

The default `docker compose up -d --build` does not build the bootstrap/tools image or start workers, Prometheus, or Grafana.

Follow logs:

```bash
docker compose logs -f migrate
docker compose logs -f app
docker compose logs -f caddy
```

Verify:

```bash
curl http://localhost/api/ready -H 'Host: fluxpoint.wetlabs.dev'
curl http://localhost/api/health -H 'Host: fluxpoint.wetlabs.dev'
curl http://localhost/api/metrics/prometheus -H 'Host: fluxpoint.wetlabs.dev'
curl http://localhost/fluxpoint -H 'Host: www.wetlabs.dev'
curl https://fluxpoint.wetlabs.dev/api/health
curl https://www.wetlabs.dev/fluxpoint
```

Expected `/api/ready` response shape:

```json
{
  "ok": true,
  "service": "fluxpoint",
  "timestamp": "2026-06-17T00:00:00.000Z",
  "version": "0.1.0"
}
```

`/api/ready` is the container readiness probe and only verifies that the Next.js server is responding. `/api/health` remains the deeper application health check and verifies database connectivity.

## Caddy Routing

The Compose stack uses `deploy/caddy/Caddyfile`:

```caddyfile
fluxpoint.wetlabs.dev {
    encode zstd gzip
    reverse_proxy app:3000
}

www.wetlabs.dev {
    encode zstd gzip

    handle /fluxpoint* {
        reverse_proxy app:3000
    }

    handle /_next* {
        reverse_proxy app:3000
    }

    handle /favicon.ico {
        reverse_proxy app:3000
    }
}
```

The active `www.wetlabs.dev` block is for deployments where this Fluxpoint container serves the real `/fluxpoint` splash route. It also proxies `/_next` assets so the splash page receives its production CSS and JavaScript. Caddy starts independently of the app container so certificate issuance and proxy startup are not blocked by a temporary app or database health failure.

If a separate Wetlabs marketing service is mounted at its own root, use `handle_path` there:

```caddyfile
www.wetlabs.dev {
    handle_path /fluxpoint* {
        reverse_proxy wetlabs-site:3000
    }
}
```

## Reboot Persistence

Docker starts at boot:

```bash
sudo systemctl enable docker
```

Compose services use `restart: unless-stopped`. Test reboot behavior:

```bash
sudo reboot
```

After reconnecting:

```bash
cd /var/www/fluxpoint
docker compose ps
curl https://fluxpoint.wetlabs.dev/api/health
```

## Updating

Use the same path for every application update:

```bash
cd /var/www/fluxpoint
git pull --ff-only
docker compose up -d --build
docker compose logs -f app
```

The `migrate` service runs during `docker compose up -d` and blocks the app until migrations complete successfully. Optional profile services do not participate.

Run `npm run check:production` in CI or a prepared checkout before production deployment.

## Backups

Create a timestamped Postgres dump:

```bash
cd /var/www/fluxpoint
bash scripts/backup-postgres.sh
```

This writes:

```text
backups/fluxpoint-YYYY-MM-DD-HHMM.sql
```

Manual equivalent:

```bash
mkdir -p backups
docker compose exec -T db pg_dump -U fluxpoint fluxpoint > backups/fluxpoint-$(date +%F-%H%M).sql
```

## Restore

Restores require an explicit confirmation prompt:

```bash
cd /var/www/fluxpoint
bash scripts/restore-postgres.sh backups/fluxpoint-YYYY-MM-DD-HHMM.sql
```

The script prints a warning and requires typing `RESTORE`. It does not silently destroy data.

## Worker Containers

Workers are present but disabled by default:

```bash
ENABLE_REMINDERS_WORKER=false
ENABLE_METRICS_WORKER=false
ENABLE_BACKUPS_WORKER=false
ENABLE_AI_WORKER=false
ENABLE_IMAGE_MODERATION_WORKER=false
SERVER_METRICS_ENABLED=true
SERVER_METRICS_RETENTION_HOURS=48
METRICS_WORKER_INTERVAL_MS=300000
BACKUP_WORKER_INTERVAL_SECONDS=60
BACKUP_RETENTION_DAYS=180
```

When enabled, workers record durable run results. The metrics worker captures server RAM, disk, network, storage, health, and incident state. The backup worker processes queued sitewide backup requests. Start them with `docker compose --profile workers up -d --build metrics backups` after enabling their flags.

## Useful Commands

```bash
docker compose ps
docker compose logs -f
docker compose logs -f app
docker compose logs -f caddy
docker compose logs -f migrate
docker compose restart app
docker compose down
docker compose up -d
```

## Optional systemd Wrapper

The default deployment relies on Docker and Compose restart policies. If you want an additional host-level unit, create a small systemd service that runs `docker compose up -d` from `/var/www/fluxpoint`, but do not add a separate systemd unit for the app container itself.
