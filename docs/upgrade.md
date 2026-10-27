# Upgrading

Trusting ships as a single Docker image. Database migrations are applied automatically when a
container starts, so an upgrade is: back up, pull or build the new image, restart.

## Before you start

1. **Read the release notes / changelog** for every version between yours and the target.
   Breaking changes (new required environment variables, changed defaults, dropped features) are
   listed there with the action you need to take.
2. **Back up** (see `docs/backup-restore.md`): database dump, object store or local storage
   folder, and your `.env`. Migrations are forward-only; the backup is your rollback.
3. Check your current version: `curl -s https://trust.example.com/api/health` returns
   `{"ok":true,"version":"x.y.z"}`.

## Upgrade with a published image

```sh
cd /opt/trusting                      # wherever docker-compose.yml and .env live
# Edit .env if the release notes introduced new settings, then:
docker compose pull app
docker compose up -d app
docker compose logs -f app            # watch "[entrypoint] applying database migrations"
```

The entrypoint waits for PostgreSQL, runs `prisma migrate deploy` (only migrations that have not
been applied yet) and then starts the server. The container's health check passes once
`/api/health` answers.

If you pinned a tag in `.env` (`TRUSTING_IMAGE=ghcr.io/z-brenner/trusting:1.2.0`), change it there
first.

## Upgrade when you build the image yourself

```sh
git fetch --tags
git checkout v1.2.0                   # or: git pull on main
docker compose build app
docker compose up -d app
```

## Upgrading the other services

- **PostgreSQL major versions** (16 -> 17) are not upgraded in place by the image. Keep
  `postgres:16-alpine` unless you plan a dump/restore migration; minor versions update with
  `docker compose pull db && docker compose up -d db`.
- **Garage** (bundled object store): check the Garage release notes for migration steps before
  changing the pinned tag in `docker-compose.yml`; data formats can change between major
  versions.

## Rollback

Migrations are not reversed automatically. To roll back:

1. `docker compose stop app`
2. Restore the database dump taken before the upgrade (`docs/backup-restore.md`). If the new
   version did not include a migration (check the release notes or
   `docker compose logs app | grep -i migration`), you can skip this step.
3. Point `TRUSTING_IMAGE` (or your git checkout) back at the previous version and
   `docker compose up -d app`.

Uploaded files are not touched by upgrades, so the object store normally does not need to be
restored unless you also deleted documents after upgrading.

## Troubleshooting

- **Container restarts in a loop** with `Invalid environment configuration` in the logs: a new
  required variable is missing or malformed in `.env`. The message lists the field.
- **`migrate deploy` fails** (for example because the database user lacks privileges or a
  previous migration was applied by hand): the container exits without starting the app, so the
  old data is untouched. Fix the cause and `docker compose up -d app` again; a partially applied
  migration is recorded by Prisma and reported in the log.
- **Health check stays unhealthy** but the log shows "Ready": verify `PORT` was not changed to a
  value other than 3000 without adjusting the Compose health check.
