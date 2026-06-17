# Fluxpoint Docker Compose Deployment

Fluxpoint production is Docker-first and mirrors the AxilDB deployment pattern where it applies: Caddy at the edge, Postgres as the primary database, a one-shot migration/bootstrap service, a standalone Next.js app container, and prepared worker containers.

Canonical URLs:

- App: `https://fluxpoint.wetlabs.dev`
- Marketing/splash: `https://wetlabs.dev/fluxpoint`

Important routing rules:

- Do not set a Next.js `basePath`.
- The app does not live under `/fluxpoint`.
- App routes remain root-relative on `fluxpoint.wetlabs.dev`, for example `/dashboard`.
- `wetlabs.dev/fluxpoint` is handled separately unless intentionally wired to the local marketing preview.

## Architecture

- `caddy`: public reverse proxy on host ports `80` and `443`, with Caddy-managed Let's Encrypt certificates persisted in Docker volumes.
- `db`: Postgres 16 with data persisted in `fluxpoint_pgdata`.
- `migrate`: one-shot Prisma migration and bootstrap container. It waits for Postgres health, runs `npm run db:migrate:deploy`, then runs `npm run db:bootstrap` when `RUN_BOOTSTRAP=true`.
- `app`: standalone Next.js production server on internal port `3000`. It depends on healthy Postgres and successful migration/bootstrap.
- `reminders`: placeholder recurring care reminder worker.
- `metrics`: placeholder app/server/sensor metrics worker.
- `backups`: placeholder queued backup worker.
- `ai-worker`: placeholder future AI/image analysis worker.

Persistent storage:

- `fluxpoint_pgdata:/var/lib/postgresql/data`
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
NEXT_PUBLIC_MARKETING_URL=https://wetlabs.dev/fluxpoint
NEXT_PUBLIC_SITE_NAME=Fluxpoint

POSTGRES_DB=fluxpoint
POSTGRES_USER=fluxpoint
POSTGRES_PASSWORD=change_me

DATABASE_URL=postgresql://fluxpoint:change_me@db:5432/fluxpoint?schema=public

ENABLE_REMINDERS_WORKER=false
ENABLE_METRICS_WORKER=false
ENABLE_BACKUPS_WORKER=false
ENABLE_AI_WORKER=false
RUN_BOOTSTRAP=true
```

Use a strong `POSTGRES_PASSWORD` and make sure `DATABASE_URL` uses the same value.

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
- `wetlabs.dev` remains handled by the existing site unless you intentionally route `/fluxpoint` to a marketing service.
- Host ports `80` and `443` must be reachable for Caddy and Let's Encrypt.

## Build And Start

```bash
docker compose build
docker compose up -d
docker compose ps
```

Follow logs:

```bash
docker compose logs -f migrate
docker compose logs -f app
docker compose logs -f caddy
```

Verify:

```bash
curl http://localhost/api/health -H 'Host: fluxpoint.wetlabs.dev'
curl https://fluxpoint.wetlabs.dev/api/health
```

Expected response shape:

```json
{
  "ok": true,
  "service": "fluxpoint",
  "timestamp": "2026-06-17T00:00:00.000Z",
  "version": "0.1.0",
  "database": "ok"
}
```

## Caddy Routing

The Compose stack uses `deploy/caddy/Caddyfile`:

```caddyfile
fluxpoint.wetlabs.dev {
    encode zstd gzip
    reverse_proxy app:3000
}
```

Marketing examples are included as comments. Do not force `wetlabs.dev/fluxpoint` through Fluxpoint unless that is the intended host-level routing.

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

```bash
cd /var/www/fluxpoint
git pull --ff-only
docker compose build
docker compose up -d
docker compose logs -f app
```

The `migrate` service runs during `docker compose up -d` and blocks the app until migrations/bootstrap complete successfully.

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
```

When enabled, each worker runs a safe heartbeat loop and can later be extended for reminders, metrics, backups, and AI/image workflows.

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
