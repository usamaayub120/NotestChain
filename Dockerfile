# syntax=docker/dockerfile:1.7

# ── Stage 1: workspace dependencies ────────────────────────────────────────
FROM node:22-alpine AS deps
RUN corepack enable
# argon2's native binding falls back to compiling from source on musl/alpine
# when no prebuilt binary matches — these are build-time only, never present
# in the final runtime stage.
RUN apk add --no-cache python3 make g++
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/validation/package.json packages/validation/package.json
COPY packages/blockchain-client/package.json packages/blockchain-client/package.json

RUN pnpm install --frozen-lockfile

# ── Stage 2: build everything ──────────────────────────────────────────────
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/validation/node_modules ./packages/validation/node_modules
COPY --from=deps /app/packages/blockchain-client/node_modules ./packages/blockchain-client/node_modules
COPY . .

# Prisma client generation needs DATABASE_URL to be *set* (not reachable) at
# generate time — it only reads the schema, never connects.
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"

RUN pnpm run db:generate
RUN pnpm run build:packages
RUN pnpm --filter @noteschain/web build
RUN pnpm --filter @noteschain/api build
RUN pnpm --filter @noteschain/worker build

# Trim dev dependencies out of node_modules before copying into the runtime image.
RUN pnpm install --prod --frozen-lockfile

# ── Stage 3: runtime image ─────────────────────────────────────────────────
FROM node:22-alpine AS runtime
# openssl is required by Prisma's query engine binary at runtime (matches
# the linux-musl-openssl-3.0.x binaryTarget in prisma/schema.prisma).
RUN apk add --no-cache nginx supervisor tini openssl \
  && addgroup -S noteschain && adduser -S noteschain -G noteschain

WORKDIR /app

# Compiled server code + production node_modules only.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/worker/dist ./apps/worker/dist
COPY --from=build /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=build /app/packages/validation/dist ./packages/validation/dist
COPY --from=build /app/packages/validation/package.json ./packages/validation/package.json
COPY --from=build /app/packages/validation/node_modules ./packages/validation/node_modules
COPY --from=build /app/packages/blockchain-client/dist ./packages/blockchain-client/dist
COPY --from=build /app/packages/blockchain-client/package.json ./packages/blockchain-client/package.json
COPY --from=build /app/packages/blockchain-client/node_modules ./packages/blockchain-client/node_modules
COPY --from=build /app/prisma ./prisma
# (no separate node_modules/.prisma copy needed — pnpm's node_modules/.pnpm
# virtual store, already copied above, contains the generated client inline
# with @prisma/client; there is no top-level hoisted .prisma folder under pnpm.)

# Frontend static build -> Nginx web root.
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

# Infra config.
COPY infra/nginx/nginx.conf /etc/nginx/nginx.conf
COPY infra/supervisor/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

RUN mkdir -p /run/secrets \
  && chown -R noteschain:noteschain /app \
  && chown -R nginx:nginx /usr/share/nginx/html /var/log/nginx /var/lib/nginx

ENV NODE_ENV=production
EXPOSE 80

# supervisord itself (PID 1 via tini) still starts as root because nginx's
# master process needs root to bind :80 — but nginx.conf's `user nginx;`
# drops its worker processes to an unprivileged user immediately, and both
# Node processes run as `noteschain` per infra/supervisor/supervisord.conf's
# per-program `user=` directive. Nothing that handles a request runs as root.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
