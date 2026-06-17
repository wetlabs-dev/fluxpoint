#!/usr/bin/env bash
set -euo pipefail

mkdir -p backups

if [ -f ".env.production" ]; then
  set -a
  # shellcheck disable=SC1091
  source .env.production
  set +a
fi

POSTGRES_DB="${POSTGRES_DB:-fluxpoint}"
POSTGRES_USER="${POSTGRES_USER:-fluxpoint}"
timestamp="$(date +%F-%H%M)"
out="backups/fluxpoint-${timestamp}.sql"

docker compose exec -T db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > "$out"
echo "Wrote $out"
