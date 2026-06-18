#!/usr/bin/env sh
set -eu

docker compose build app
docker compose up -d --no-deps app
docker compose ps app
