#!/usr/bin/env sh
set -eu

git pull --ff-only
docker compose build app
docker compose up -d --no-deps app
docker compose ps app
docker compose logs --tail=80 app
