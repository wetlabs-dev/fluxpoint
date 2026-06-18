# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache openssl ca-certificates

FROM base AS deps
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

FROM base AS source
ENV DATABASE_URL=postgresql://fluxpoint:change_me@db:5432/fluxpoint?schema=public
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN --mount=type=cache,target=/root/.cache/prisma npx prisma generate

FROM source AS tools

FROM source AS builder
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
