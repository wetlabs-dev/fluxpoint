#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/fluxpoint}"
APP_USER="${APP_USER:-fluxpoint}"
SERVICE_NAME="${SERVICE_NAME:-fluxpoint.service}"

cd "$APP_DIR"

run_app() {
  if [ "$(id -u)" -eq 0 ]; then
    sudo -u "$APP_USER" "$@"
  else
    "$@"
  fi
}

run_app git pull --ff-only
run_app npm ci
run_app npm run build:production

sudo systemctl restart "$SERVICE_NAME"
sudo systemctl --no-pager --lines=30 status "$SERVICE_NAME"
