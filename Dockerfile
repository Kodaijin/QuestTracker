# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 – deps
# Install production dependencies only (cache-friendly lockfile layer).
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 – builder
# Full install (dev + prod), generate Prisma client, compile Next.js.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Layer-cache dependencies separately from source so a code change
# does not force an npm re-install.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Ensure public/ exists (Next.js static-file convention).
RUN mkdir -p public

# OpenSSL is required for Prisma engine detection and binary compilation.
RUN apk add --no-cache openssl

# Generate Prisma client for the linux-musl-openssl-3.0.x target.
RUN npx prisma generate

# Produces .next/standalone via next.config.js output: 'standalone'.
RUN npx next build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3 – runner
# Minimal production image; no dev dependencies, no source code.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# OpenSSL 3.x is required at runtime by the Prisma migration and query engines.
RUN apk add --no-cache openssl

# tzdata provides IANA timezone database so process.env.TZ (e.g. Etc/GMT+8, America/Los_Angeles) resolves correctly.
RUN apk add --no-cache tzdata

# Set default timezone for quest reset/missed-quest day boundaries (midnight).
# Can be overridden at runtime by docker-compose or container env flag.
ENV TZ=Etc/GMT+8

# Non-root user for security.
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 --ingroup nodejs nextjs

# Next.js standalone bundle (already contains a trimmed node_modules).
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static    ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public          ./public

# Prisma schema + migration files (needed by migrate deploy).
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Prisma generated client – native binary (platform-specific, not in standalone).
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma  ./node_modules/.prisma

# Prisma JS client package (imported by server actions at runtime).
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma  ./node_modules/@prisma

# Prisma CLI (needed for `migrate deploy` in the entrypoint).
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma   ./node_modules/prisma

# Entrypoint: run migrations then start the server.
COPY entrypoint.sh ./
RUN  chmod +x entrypoint.sh

USER nextjs
EXPOSE 3000

ENTRYPOINT ["./entrypoint.sh"]
