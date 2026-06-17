#!/usr/bin/env bash
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: $0 backups/fluxpoint-YYYY-MM-DD-HHMM.sql" >&2
  exit 1
fi

backup_file="$1"
if [ ! -f "$backup_file" ]; then
  echo "Backup file not found: $backup_file" >&2
  exit 1
fi

if [ -f ".env.production" ]; then
  set -a
  # shellcheck disable=SC1091
  source .env.production
  set +a
fi

POSTGRES_DB="${POSTGRES_DB:-fluxpoint}"
POSTGRES_USER="${POSTGRES_USER:-fluxpoint}"

echo "WARNING: This will apply $backup_file to database $POSTGRES_DB in the running Compose stack."
echo "It may overwrite or conflict with existing data. Type RESTORE to continue:"
read -r confirmation

if [ "$confirmation" != "RESTORE" ]; then
  echo "Restore cancelled."
  exit 1
fi

docker compose exec -T db psql -U "$POSTGRES_USER" "$POSTGRES_DB" < "$backup_file"
echo "Restore command completed."
