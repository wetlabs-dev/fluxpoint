#!/usr/bin/env sh
set -eu

before="$(git rev-parse HEAD)"
git pull --ff-only
after="$(git rev-parse HEAD)"

if [ "${FORCE_REBUILD:-false}" = "true" ] || [ "$before" != "$after" ] || ! docker image inspect fluxpoint-app >/dev/null 2>&1; then
  docker compose build app
else
  echo "No new commit and fluxpoint-app image exists; skipping app image rebuild."
fi

docker compose up -d --no-deps app
docker compose ps app
docker compose logs --tail=80 app
