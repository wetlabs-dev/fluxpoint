# Fluxpoint Ubuntu Deployment With Caddy And systemd

This guide deploys Fluxpoint as a Next.js production service on Ubuntu. The app runs on `127.0.0.1:3021`; Caddy terminates HTTPS for `https://fluxpoint.wetlabs.dev`; systemd keeps the app alive after crashes and reboots.

Fluxpoint app URL: `https://fluxpoint.wetlabs.dev`

Marketing URL: `https://wetlabs.dev/fluxpoint`

App directory: `/var/www/fluxpoint`

Linux service user: `fluxpoint`

systemd service: `fluxpoint.service`

App port: `3021`

## 1. Install Node LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs git
node --version
npm --version
```

Optional pnpm install:

```bash
sudo corepack enable
corepack prepare pnpm@latest --activate
pnpm --version
```

The included deployment scripts use `npm`.

## 2. Create The Service User And App Directory

```bash
sudo useradd --system --create-home --shell /usr/sbin/nologin fluxpoint
sudo mkdir -p /var/www/fluxpoint
sudo chown -R fluxpoint:fluxpoint /var/www/fluxpoint
```

## 3. Clone The Repository

```bash
sudo -u fluxpoint git clone https://github.com/wetlabs-dev/fluxpoint.git /var/www/fluxpoint
cd /var/www/fluxpoint
```

## 4. Create The Production Environment File

```bash
sudo -u fluxpoint cp .env.production.example .env.production
sudo -u fluxpoint nano .env.production
```

Required values:

```bash
NODE_ENV=production
PORT=3021
HOST=127.0.0.1

NEXT_PUBLIC_APP_URL=https://fluxpoint.wetlabs.dev
NEXT_PUBLIC_MARKETING_URL=https://wetlabs.dev/fluxpoint
NEXT_PUBLIC_SITE_NAME=Fluxpoint

DATABASE_URL=file:./prod.db
```

Future PostgreSQL example:

```bash
DATABASE_URL=postgresql://fluxpoint:password@localhost:5432/fluxpoint
```

## 5. Install Dependencies

```bash
cd /var/www/fluxpoint
sudo -u fluxpoint npm ci
```

## 6. Generate Prisma Client And Run Migrations

```bash
cd /var/www/fluxpoint
sudo -u fluxpoint bash -lc 'set -a; source .env.production; set +a; npx prisma generate'
sudo -u fluxpoint bash -lc 'set -a; source .env.production; set +a; npx prisma migrate deploy'
```

For a fresh SQLite deployment, the initial migration creates the database at `/var/www/fluxpoint/prisma/prod.db` because `DATABASE_URL=file:./prod.db` is resolved relative to the Prisma schema directory.

Optional first-time seed:

```bash
sudo -u fluxpoint bash -lc 'set -a; source .env.production; set +a; npm run prisma:seed'
```

## 7. Build The App

```bash
cd /var/www/fluxpoint
sudo -u fluxpoint npm run build:production
```

`scripts/build-production.sh` runs:

```bash
npx prisma generate
npx prisma migrate deploy
npx next build
```

For local build troubleshooting only, `SKIP_PRISMA_MIGRATE=1 npm run build:production` skips migration execution. Do not use that for normal server deployment.

The script also copies standalone assets required by Next:

```bash
public -> .next/standalone/public
.next/static -> .next/standalone/.next/static
```

## 8. Start Manually For Testing

```bash
cd /var/www/fluxpoint
sudo -u fluxpoint bash -lc 'set -a; source .env.production; set +a; HOSTNAME=${HOSTNAME:-$HOST} npm run start:standalone'
```

In another shell:

```bash
curl http://127.0.0.1:3021/api/health
```

Expected shape:

```json
{
  "ok": true,
  "service": "fluxpoint",
  "timestamp": "2026-06-17T00:00:00.000Z",
  "version": "0.1.0"
}
```

Stop the manual server with `Ctrl+C` before installing systemd.

## 9. Install The systemd Unit

```bash
sudo cp /var/www/fluxpoint/deploy/systemd/fluxpoint.service /etc/systemd/system/fluxpoint.service
sudo systemctl daemon-reload
sudo systemctl enable fluxpoint
sudo systemctl start fluxpoint
sudo systemctl status fluxpoint
```

View logs:

```bash
sudo journalctl -u fluxpoint -f
```

Restart service:

```bash
sudo systemctl restart fluxpoint
sudo systemctl status fluxpoint
```

## 10. Install And Configure Caddy

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

Copy or merge the Fluxpoint Caddy example:

```bash
sudo cp /var/www/fluxpoint/deploy/caddy/Caddyfile.fluxpoint /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo systemctl status caddy
```

Fluxpoint app host:

```caddyfile
fluxpoint.wetlabs.dev {
    encode zstd gzip
    reverse_proxy 127.0.0.1:3021
}
```

Marketing route is separate and should be handled by the service that owns `wetlabs.dev`:

```caddyfile
wetlabs.dev {
    handle_path /fluxpoint* {
        reverse_proxy 127.0.0.1:3022
    }

    # existing wetlabs.dev handlers may go here
}
```

Do not deploy Fluxpoint with `basePath=/fluxpoint`. The app subdomain serves root-relative app routes like `/dashboard`.

## 11. Verify HTTPS And Health

```bash
curl -I https://fluxpoint.wetlabs.dev
curl https://fluxpoint.wetlabs.dev/api/health
curl -I https://wetlabs.dev/fluxpoint
```

Caddy automatically provisions and renews Let's Encrypt certificates when DNS points at the server and ports 80/443 are reachable.

## 12. Reboot Test

```bash
sudo systemctl enable fluxpoint
sudo reboot
```

After reconnecting:

```bash
sudo systemctl status fluxpoint
sudo systemctl status caddy
curl https://fluxpoint.wetlabs.dev/api/health
```

Confirm:

- `fluxpoint.service` is active after reboot.
- Caddy is active after reboot.
- `https://fluxpoint.wetlabs.dev/api/health` returns `ok: true`.
- HTTPS certificate issuance succeeded.
- `https://wetlabs.dev/fluxpoint` still serves the marketing page.

## 13. Update Deployment After git pull

Manual update:

```bash
cd /var/www/fluxpoint
sudo -u fluxpoint git pull --ff-only
sudo -u fluxpoint npm ci
sudo -u fluxpoint npm run build:production
sudo systemctl restart fluxpoint
sudo systemctl status fluxpoint
```

Or use the included local deployment script:

```bash
cd /var/www/fluxpoint
sudo APP_DIR=/var/www/fluxpoint APP_USER=fluxpoint SERVICE_NAME=fluxpoint.service bash scripts/deploy-local.sh
```

## 14. Backup Notes

Create a backup directory:

```bash
sudo mkdir -p /var/backups/fluxpoint
sudo chown fluxpoint:fluxpoint /var/backups/fluxpoint
```

SQLite backup:

```bash
sudo -u fluxpoint cp /var/www/fluxpoint/prisma/prod.db /var/backups/fluxpoint/fluxpoint-$(date +%F-%H%M).db
```

Future PostgreSQL backup:

```bash
pg_dump fluxpoint > /var/backups/fluxpoint/fluxpoint-$(date +%F-%H%M).sql
```

## 15. Operational Checklist

```bash
sudo systemctl enable fluxpoint
sudo systemctl start fluxpoint
sudo systemctl status fluxpoint
sudo journalctl -u fluxpoint -f
sudo reboot
```

After reboot:

```bash
sudo systemctl status fluxpoint
sudo systemctl status caddy
curl http://127.0.0.1:3021/api/health
curl https://fluxpoint.wetlabs.dev/api/health
curl -I https://fluxpoint.wetlabs.dev
```

Checklist:

- Service starts through systemd.
- Service restarts after failure.
- Service comes back after reboot.
- Caddy reverse proxy reaches `127.0.0.1:3021`.
- HTTPS certificate is issued and active.
- App routes are root-relative on `fluxpoint.wetlabs.dev`.
- Marketing remains separate at `wetlabs.dev/fluxpoint`.
