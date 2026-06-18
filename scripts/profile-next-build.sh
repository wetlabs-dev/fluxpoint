#!/usr/bin/env bash
set -euo pipefail

mkdir -p logs
stamp="$(date +%Y%m%d-%H%M%S)"
log_file="logs/build-profile-${stamp}.log"

echo "Fluxpoint Next build profile"
echo "Started: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "Log: ${log_file}"

run_step() {
  local name="$1"
  shift
  local start
  local end
  start="$(date +%s)"
  {
    echo
    echo "===== ${name} ====="
    echo "Command: $*"
    echo "Started: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  } | tee -a "${log_file}"

  "$@" 2>&1 | tee -a "${log_file}"

  end="$(date +%s)"
  {
    echo "Finished: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo "Duration: $((end - start))s"
  } | tee -a "${log_file}"
}

run_step "prisma generate" npx prisma generate
run_step "next build" npm run build

if [ "${RUN_NEXT_PRIVATE_BUILD_WORKER:-false}" = "true" ]; then
  run_step "next build with NEXT_PRIVATE_BUILD_WORKER=1" env NEXT_PRIVATE_BUILD_WORKER=1 npm run build
fi

{
  echo
  echo "===== Next phase hints ====="
  grep -E "Creating an optimized production build|Compiled successfully|Linting and checking validity of types|Collecting page data|Generating static pages|Finalizing page optimization|Collecting build traces" "${log_file}" || true
  echo
  echo "Completed: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
} | tee -a "${log_file}"

echo "Profile written to ${log_file}"
