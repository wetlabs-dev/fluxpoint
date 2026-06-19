# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NPM_CONFIG_AUDIT=false
ENV NPM_CONFIG_FUND=false
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV NPM_CONFIG_PROGRESS=false
RUN apk add --no-cache openssl ca-certificates

FROM base AS deps
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund --prefer-offline --progress=false

FROM base AS tools-deps
COPY package-lock.json ./
RUN --mount=type=cache,target=/root/.npm node -e 'const lock=require("./package-lock.json").packages; const names=["@next/env","@prisma/client","date-fns","nodemailer","prisma","tsx","typescript","zod"]; const packages=names.map((name)=>{ const entry=lock[`node_modules/${name}`]; if (!entry?.version) throw new Error(`Missing lockfile entry for ${name}`); return `${name}@${entry.version}`; }); require("node:child_process").execFileSync("npm", ["install", "--no-save", "--package-lock=false", "--no-audit", "--no-fund", "--prefer-offline", "--progress=false", ...packages], { stdio: "inherit" });'

FROM base AS prisma-client
ENV DATABASE_URL=postgresql://fluxpoint:change_me@db:5432/fluxpoint?schema=public
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY prisma ./prisma
RUN --mount=type=cache,target=/root/.cache/prisma npx prisma generate

FROM base AS app-source
ENV DATABASE_URL=postgresql://fluxpoint:change_me@db:5432/fluxpoint?schema=public
COPY --from=prisma-client /app/node_modules ./node_modules
COPY . .

FROM base AS tools
ENV NODE_ENV=production
ENV DATABASE_URL=postgresql://fluxpoint:change_me@db:5432/fluxpoint?schema=public
COPY --from=tools-deps /app/node_modules ./node_modules
COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma
COPY scripts ./scripts
COPY src/domains ./src/domains
COPY src/lib ./src/lib
RUN --mount=type=cache,target=/root/.cache/prisma npx prisma generate
CMD ["npm", "run", "db:migrate:deploy"]

FROM app-source AS builder
ENV NEXT_SKIP_BUILD_CHECKS=true
RUN --mount=type=cache,target=/app/.next/cache npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup -S -g 1001 nodejs \
  && adduser -S -u 1001 -G nodejs nextjs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
RUN mkdir -p /app/public/uploads /app/public/labels /app/backups \
  && chown -R nextjs:nodejs /app/public /app/backups
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
