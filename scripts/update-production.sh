#!/usr/bin/env sh
set -eu

git pull --ff-only
if command -v npm >/dev/null 2>&1 && [ -d node_modules ]; then
  npm run check:production
else
  echo "Skipping local check:production because npm or node_modules is unavailable on this host."
  echo "Run npm run check:production in CI or a prepared checkout before deploying."
fi
docker compose build app migrate
docker compose up -d
docker compose ps
docker compose logs --tail=80 app
