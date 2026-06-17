#!/usr/bin/env bash
set -euo pipefail

export NODE_ENV="${NODE_ENV:-production}"

if [ -f ".env.production" ]; then
  set -a
  # shellcheck disable=SC1091
  source ".env.production"
  set +a
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required. Create .env.production from .env.production.example." >&2
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "node_modules not found; installing dependencies with npm ci."
  npm ci
fi

npx prisma generate
if [ "${SKIP_PRISMA_MIGRATE:-0}" = "1" ]; then
  echo "Skipping prisma migrate deploy because SKIP_PRISMA_MIGRATE=1."
else
  npx prisma migrate deploy
fi
npx next build

mkdir -p .next/standalone/.next
if [ -d "public" ]; then
  rm -rf .next/standalone/public
  cp -R public .next/standalone/public
else
  mkdir -p .next/standalone/public
fi
rm -rf .next/standalone/.next/static
cp -R .next/static .next/standalone/.next/static

echo "Fluxpoint production build is ready in .next/standalone."
