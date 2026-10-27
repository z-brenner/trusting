#!/bin/sh
# Container entrypoint for Trusting.
#
#   1. Wait until the PostgreSQL host named in DATABASE_URL accepts TCP connections.
#   2. Apply pending database migrations with `prisma migrate deploy` (idempotent).
#   3. Replace this process with the command given (normally `node server.js`).
#
# Usage:
#   trusting-entrypoint node server.js   # default CMD: migrate, then serve
#   trusting-entrypoint migrate          # run migrations only, then exit
#
# Environment knobs (all optional):
#   SKIP_MIGRATIONS=true   do not run migrations at start (e.g. when you run
#                          `docker compose run --rm app migrate` yourself first)
#   DB_WAIT_SECONDS=60     how long to wait for the database before giving up
set -eu

APP_DIR="${APP_DIR:-/app}"
PRISMA_DIR="${PRISMA_DIR:-/opt/prisma}"
export DB_WAIT_SECONDS="${DB_WAIT_SECONDS:-60}"
# Keep the Prisma CLI quiet and offline (no update checks, no telemetry).
export PRISMA_HIDE_UPDATE_MESSAGE=1 CHECKPOINT_DISABLE=1

log() { printf '[entrypoint] %s\n' "$*"; }

if [ -z "${DATABASE_URL:-}" ]; then
  log "DATABASE_URL is not set. See docs/configuration.md."
  exit 1
fi

wait_for_db() {
  node -e '
    const net = require("node:net");
    let url;
    try { url = new URL(process.env.DATABASE_URL); } catch {
      console.log("[entrypoint] DATABASE_URL is not a URL; skipping the connectivity wait");
      process.exit(0);
    }
    const host = url.hostname;
    const port = Number(url.port || 5432);
    if (!host) process.exit(0);
    const waitSeconds = Number(process.env.DB_WAIT_SECONDS || 60);
    const deadline = Date.now() + waitSeconds * 1000;
    console.log(`[entrypoint] waiting for database at ${host}:${port}`);
    const attempt = () => {
      const socket = net.connect({ host, port });
      socket.setTimeout(3000);
      socket.on("connect", () => { socket.destroy(); console.log("[entrypoint] database is reachable"); process.exit(0); });
      const retry = () => {
        socket.destroy();
        if (Date.now() > deadline) {
          console.error(`[entrypoint] database at ${host}:${port} not reachable after ${waitSeconds}s`);
          process.exit(1);
        }
        setTimeout(attempt, 1000);
      };
      socket.on("error", retry);
      socket.on("timeout", retry);
    };
    attempt();
  '
}

run_migrations() {
  log "applying database migrations"
  (cd "$PRISMA_DIR" && exec node node_modules/prisma/build/index.js migrate deploy)
  log "migrations are up to date"
}

case "${1:-}" in
  migrate)
    wait_for_db
    run_migrations
    exit 0
    ;;
esac

if [ "${SKIP_MIGRATIONS:-false}" = "true" ]; then
  log "SKIP_MIGRATIONS=true, not touching the database schema"
else
  wait_for_db
  run_migrations
fi

cd "$APP_DIR"
log "starting: $*"
exec "$@"
