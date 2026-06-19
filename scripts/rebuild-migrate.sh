#!/usr/bin/env sh
set -eu

docker compose build migrate
docker compose run --rm migrate
