# syntax=docker/dockerfile:1.7
#
# Trusting - production image
#
#   deps        install all dependencies with pnpm (dev dependencies are needed to build)
#   build       prisma generate + next build (standalone output)
#   prisma-cli  a tiny, separate install of the Prisma CLI so the runtime image can
#               run `prisma migrate deploy` without the application's full node_modules
#   runner      slim Debian image, non-root, migrations applied at start by the entrypoint
#
# Build:  docker build -t trusting .
# Run:    see docker-compose.yml and docs/install.md
#
# No secrets are baked into the image. All configuration is read from the
# environment at runtime (see .env.example and docs/configuration.md).

ARG NODE_IMAGE=node:22-bookworm-slim
ARG PNPM_VERSION=10.28.0

# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS base
ARG PNPM_VERSION
ENV NEXT_TELEMETRY_DISABLED=1 \
    CI=1
RUN npm install -g pnpm@${PNPM_VERSION} && npm cache clean --force
WORKDIR /app

# ---------------------------------------------------------------------------
FROM base AS deps
# pnpm-workspace.yaml carries onlyBuiltDependencies (prisma, @prisma/engines, esbuild).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
FROM deps AS build
COPY . .
# `prisma generate` and `next build` never open a database connection, but
# prisma.config.ts resolves DATABASE_URL eagerly and `next build` imports the
# server modules (src/lib/db.ts) while collecting route metadata, which runs the
# zod validation in src/lib/env.ts. These placeholders only satisfy that
# validation at build time; they are not present in the runner stage and
# Next.js never inlines non-NEXT_PUBLIC_ variables into the bundle.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    SESSION_SECRET="build-time-placeholder-value-not-used-at-runtime" \
    ENCRYPTION_KEY="1111111111111111111111111111111111111111111111111111111111111111" \
    STORAGE_DRIVER=local
RUN pnpm build

# ---------------------------------------------------------------------------
FROM base AS prisma-cli
WORKDIR /opt/prisma
# Self-contained project: prisma + @prisma/config + dotenv, hoisted layout
# (docker/prisma-cli/.npmrc) so it can be copied as a plain directory.
# @prisma/engines downloads the schema engine for this platform (debian-openssl-3.0.x).
COPY docker/prisma-cli/package.json docker/prisma-cli/pnpm-lock.yaml \
     docker/prisma-cli/pnpm-workspace.yaml docker/prisma-cli/.npmrc ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod

# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    PRISMA_HIDE_UPDATE_MESSAGE=1 \
    CHECKPOINT_DISABLE=1

# openssl: the Prisma schema engine links against libssl3.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Next.js standalone output: server.js, traced node_modules, .next/server.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public

# Migration toolkit (see docker/prisma-cli/README.md).
COPY --from=prisma-cli --chown=node:node /opt/prisma /opt/prisma
COPY --chown=node:node prisma.config.ts /opt/prisma/prisma.config.ts
COPY --chown=node:node prisma /opt/prisma/prisma

COPY --chmod=755 docker/entrypoint.sh /usr/local/bin/trusting-entrypoint

# Default location for STORAGE_DRIVER=local (LOCAL_STORAGE_PATH=./storage).
RUN mkdir -p /app/storage && chown node:node /app/storage

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["trusting-entrypoint"]
CMD ["node", "server.js"]
