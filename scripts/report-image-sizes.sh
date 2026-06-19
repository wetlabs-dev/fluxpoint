#!/usr/bin/env sh
set -eu

echo "Fluxpoint image sizes:"
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedSince}}" | grep -E '^(fluxpoint|REPOSITORY)' || true

echo
echo "fluxpoint-tools history:"
docker history fluxpoint-tools --no-trunc || true

echo
echo "fluxpoint-app history:"
docker history fluxpoint-app --no-trunc || true
