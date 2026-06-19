#!/usr/bin/env sh
set -eu

before="$(git rev-parse HEAD)"
git pull --ff-only
after="$(git rev-parse HEAD)"

if command -v npm >/dev/null 2>&1 && [ -d node_modules ]; then
  npm run check:production
else
  echo "Skipping local check:production because npm or node_modules is unavailable on this host."
  echo "Run npm run check:production in CI or a prepared checkout before deploying."
fi

if [ "$before" = "$after" ] && docker image inspect fluxpoint-app >/dev/null 2>&1; then
  echo "No new commit pulled and fluxpoint-app exists; skipping image rebuild."
  docker compose up -d
elif [ "$before" = "$after" ]; then
  echo "No new commit pulled, but fluxpoint-app is missing; building app image."
  docker compose build app
  docker compose up -d --no-deps app
else
  changed_files="$(git diff --name-only "$before" "$after")"
  if echo "$changed_files" | grep -Eq '^(Dockerfile|docker-compose\.yml|package(-lock)?\.json|prisma/|scripts/|src/domains/|src/lib/)'; then
    echo "Migrations, tooling, dependencies, or shared server code changed; building app and migrate images."
    docker compose build app migrate
    docker compose up -d
  else
    echo "Only app surface files changed; building and restarting app without rebuilding dependencies."
    docker compose build app
    docker compose up -d --no-deps app
  fi
fi

docker compose ps
docker compose logs --tail=80 app
