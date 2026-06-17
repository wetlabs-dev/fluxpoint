#!/usr/bin/env sh
set -eu

git pull --ff-only
docker compose build app migrate reminders metrics backups ai-worker
docker compose up -d
docker compose ps
docker compose logs --tail=80 app
