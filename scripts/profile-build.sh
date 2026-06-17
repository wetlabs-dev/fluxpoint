#!/usr/bin/env sh
set -eu

mkdir -p logs
stamp="$(date +%Y%m%d-%H%M%S)"
log_file="logs/build-${stamp}.log"

start_epoch="$(date +%s)"
echo "Starting Docker Compose build profile at $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "Writing plain build output to ${log_file}"

docker compose --progress=plain build 2>&1 | tee "${log_file}"

end_epoch="$(date +%s)"
duration="$((end_epoch - start_epoch))"
echo "Finished Docker Compose build profile at $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "Duration: ${duration}s"
echo "Log: ${log_file}"

echo
echo "Slow-step hints:"
grep -E "#[0-9]+ .* (npm ci|prisma generate|npm run build|next build|COPY \\.|load build context)" "${log_file}" || true
