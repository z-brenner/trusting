# Backup and restore

A Trusting installation consists of four things. Back up all of them; a database dump without the
files (or without the secrets) is not a usable backup.

| What | Where (default Compose stack) | How to back up |
| --- | --- | --- |
| PostgreSQL database | volume `trusting_db-data` | `pg_dump` (below) |
| Uploaded files | Garage volumes `trusting_garage-meta` + `trusting_garage-data`, or `trusting_app-storage` with `STORAGE_DRIVER=local`, or your external S3 bucket | volume archive, `rclone`, or the provider's tooling |
| Secrets and settings | `.env` | copy the file (encrypted at rest) |
| Compose files | `docker-compose.yml`, `docker/garage.toml`, any proxy config | git or copy |

Keep backups encrypted and off the server. The commands below assume you are in the directory
holding `docker-compose.yml` and that the project name is `trusting` (the directory name, unless
you set `COMPOSE_PROJECT_NAME`).

## Why the secrets are part of the backup

- `ENCRYPTION_KEY` encrypts the Google / Microsoft OAuth tokens stored in the database. Restoring
  a database with a different key makes those rows unreadable: the integrations have to be
  disconnected and connected again. Nothing else is lost, but if you cannot reconnect (the person
  who authorised left), the imported document links stay but automatic re-import stops working.
- `SESSION_SECRET` signs download links and other short-lived tokens. A new value only invalidates
  outstanding links and signs administrators out; harmless, but keep the original to make a
  restore seamless.
- `S3_*` / `GARAGE_RPC_SECRET` / `POSTGRES_PASSWORD` are needed to read the restored volumes.

## Database

Dump (custom format, compressed; `-T` keeps `docker compose exec` from allocating a TTY):

```sh
docker compose exec -T db pg_dump -U trusting -d trusting -Fc > trusting-$(date +%F).dump
```

Restore into the running `db` container (stop the app first so it does not write during the
restore):

```sh
docker compose stop app
docker compose exec -T db pg_restore -U trusting -d trusting --clean --if-exists --no-owner < trusting-2026-01-31.dump
docker compose start app
```

For an external PostgreSQL use the same `pg_dump` / `pg_restore` against its host. Automate the
dump with cron or a systemd timer and keep several generations.

## Files

### Bundled Garage store

Option A - archive the volumes (simple, consistent if Garage is stopped first):

```sh
docker compose stop garage
docker run --rm -v trusting_garage-meta:/meta:ro -v trusting_garage-data:/data:ro -v "$PWD":/backup alpine \
  sh -c 'tar czf /backup/garage-$(date +%F).tgz -C / meta data'
docker compose start garage
```

Restore (to an empty installation): create the volumes by starting the stack once, stop
`garage`, then

```sh
docker run --rm -v trusting_garage-meta:/meta -v trusting_garage-data:/data -v "$PWD":/backup alpine \
  sh -c 'rm -rf /meta/* /data/* && tar xzf /backup/garage-2026-01-31.tgz -C /'
docker compose start garage
```

Option B - copy the objects over the S3 API (no downtime; works for any S3-compatible store).
Publish the S3 port on localhost by uncommenting the `ports` entry of the `garage` service
(`127.0.0.1:3900:3900`), then with [rclone](https://rclone.org):

```sh
rclone sync ":s3,provider=Other,endpoint=http://127.0.0.1:3900,region=us-east-1,force_path_style=true,access_key_id=$S3_ACCESS_KEY_ID,secret_access_key=$S3_SECRET_ACCESS_KEY:trusting" ./files-backup
```

Reverse the two arguments to restore. Object keys are random and referenced from the database,
so keep database and file backups from the same point in time.

### Local storage driver

```sh
docker run --rm -v trusting_app-storage:/data:ro -v "$PWD":/backup alpine tar czf /backup/storage-$(date +%F).tgz -C /data .
```

If you used a bind mount (`./storage`), back up that directory with your normal file backup.
Restore by extracting into the volume / directory and fixing ownership (`chown -R 1000:1000`).

### External S3

Use your provider's versioning / replication / backup features, or `rclone sync` as above with the
provider's endpoint.

## Full restore on a new host

1. Install Docker, copy `docker-compose.yml`, the `docker/` folder and your backed-up `.env`.
2. `docker compose up -d db garage` (or only `db` for external S3 / local storage) and wait until
   `docker compose ps` shows them healthy. Garage will create the configured key and bucket on
   this first start.
3. Restore the files (Option A requires stopping `garage` again; Option B works while it runs).
4. Restore the database: `docker compose exec -T db pg_restore -U trusting -d trusting --clean --if-exists --no-owner < backup.dump`.
5. `docker compose up -d` to start the app. It applies any migrations newer than the dump and
   serves. Sign in with an existing administrator account and open a few documents.

## Test your restore

A backup you have never restored is a hope, not a backup. Once a quarter:

1. On a scratch machine (or the same host with a different project name:
   `COMPOSE_PROJECT_NAME=trusting-restore docker compose ...` and a different `TRUSTING_PORT`),
   perform the full restore above with the newest backup set.
2. Verify: `/api/health` is OK, you can sign in, the public page shows the published content,
   a `PUBLIC` document downloads, and the admin document list shows no "File missing from
   storage" errors when opening files.
3. Write down how long it took and what was unclear; fix the runbook.
4. `docker compose down -v` the scratch project.

## Retention and privacy

Backups contain personal data (administrator accounts, access requesters' names and emails, audit
log IP addresses) and confidential documents. Encrypt them, limit who can read them, and delete
them according to your retention policy.
