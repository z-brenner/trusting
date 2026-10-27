# Installing with Docker Compose

This guide takes you from an empty server to a running Trust Center. It assumes you are
comfortable with Docker and a terminal, and that you have a domain name pointing at the server
(for production). Read `docs/deployment.md` for the reverse proxy and `docs/configuration.md`
for every setting.

## What you get

`docker-compose.yml` starts three containers:

| Service | Image | Purpose | Data |
| --- | --- | --- | --- |
| `app` | this repository's `Dockerfile` (or a published image) | Trusting itself, port 3000 | volume `app-storage` (only used with `STORAGE_DRIVER=local`) |
| `db` | `postgres:16-alpine` | Database | volume `db-data` |
| `garage` | `dxflrs/garage:v2.5.0` | S3-compatible object store for uploaded files | volumes `garage-meta`, `garage-data` |

Only the app is published on the host (port 3000). PostgreSQL and Garage are reachable from the
other containers only. On start the app waits for the database, applies pending migrations and
then serves.

About the object store: the usual self-hosted choice, MinIO, was archived in 2026 and its
container images are no longer published, so the bundled store is
[Garage](https://garagehq.deuxfleurs.fr) (AGPL-3.0), a small, mature S3 server. Trusting only
speaks plain S3, so you can replace it with any S3-compatible service (see the variants below).

## Prerequisites

- Linux host (2 vCPU / 2 GB RAM is plenty for a small team), Docker Engine 24+ with the Compose
  plugin (`docker compose version` prints v2.24 or newer).
- A domain name and a way to terminate TLS (Caddy, nginx, Traefik, a cloud load balancer).
  Signing in only works over HTTPS in production.
- Outbound internet access during the build (to download packages) and, optionally, to Google /
  Microsoft / your SMTP server at runtime.

## Step 1 - get the files

Either clone the repository (needed if you build the image yourself):

```sh
git clone https://github.com/z-brenner/trusting.git /opt/trusting
cd /opt/trusting
```

or, if you use a published image, copy just `docker-compose.yml`, the `docker/` folder (it holds
`garage.toml`) and `.env.example` into a directory of your choice.

## Step 2 - create your `.env`

```sh
cp .env.example .env
```

Open `.env` and set at least:

```ini
# The URL your users will type (https in production, no trailing slash)
APP_URL=https://trust.example.com
TRUST_PROXY=true                      # when behind a reverse proxy

# Database: pick a password and use it in both lines
POSTGRES_PASSWORD=<openssl rand -hex 16>
DATABASE_URL=postgresql://trusting:<same password>@db:5432/trusting

# Application secrets
SESSION_SECRET=<openssl rand -hex 32>
ENCRYPTION_KEY=<openssl rand -hex 32>

# Bundled object store (Garage)
STORAGE_DRIVER=s3
S3_ENDPOINT=http://garage:3900
S3_REGION=us-east-1
S3_BUCKET=trusting
S3_ACCESS_KEY_ID=<echo "GK$(openssl rand -hex 12)">     # Garage requires this format
S3_SECRET_ACCESS_KEY=<openssl rand -hex 32>
S3_FORCE_PATH_STYLE=true
GARAGE_RPC_SECRET=<openssl rand -hex 32>
```

Everything else can stay at its default for now. `.env` contains secrets: keep it readable only
by you (`chmod 600 .env`) and include it in your backups (`docs/backup-restore.md`).

## Step 3 - start

```sh
docker compose up -d
docker compose logs -f app
```

The first start builds the image if no published image is configured (several minutes), then you
should see:

```
[entrypoint] waiting for database at db:5432
[entrypoint] database is reachable
[entrypoint] applying database migrations
...
All migrations have been successfully applied.
[entrypoint] starting: node server.js
▲ Next.js ...
✓ Ready
```

Check it answers: `curl -s http://localhost:3000/api/health` returns `{"ok":true,"version":"..."}`.
`docker compose ps` shows `app`, `db` and `garage` as `healthy`.

## Step 4 - first run: create the administrator

Open **http://localhost:3000/setup** (or your public URL once the proxy is up). The setup page
exists only while no administrator account exists; it asks for a name, email and password and
signs you in. After that, `/setup` redirects to `/login`.

You land in the admin area, where the guided builder walks you through company profile,
compliance frameworks, subprocessors, documents, contacts and certifications. Nothing is visible
to the public until you press **Publish**.

## Step 5 - put it behind HTTPS

Follow `docs/deployment.md`. Then re-check `APP_URL` in `.env` matches the public URL and run
`docker compose up -d` to apply.

## Variants

### External S3 service (AWS S3, Cloudflare R2, Backblaze B2, Hetzner, Wasabi, your own store)

1. Create a **private** bucket and an access key limited to it (read, write, delete, list).
2. In `.env` set `STORAGE_DRIVER=s3`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`,
   `S3_REGION` (the bucket's region for AWS, `auto` for R2, as documented by your provider
   otherwise) and `S3_ENDPOINT` (empty for AWS, the provider's endpoint URL otherwise).
   `S3_FORCE_PATH_STYLE=false` is fine for AWS; keep `true` for most self-hosted stores.
3. In `docker-compose.yml` delete the `garage` service, the two `garage-*` entries under
   `volumes:` at the bottom, and the `garage:` block under `app.depends_on`. `GARAGE_RPC_SECRET`
   is then no longer needed.
4. `docker compose up -d`.

### External PostgreSQL (managed database)

1. Create a database and a role that owns it (Prisma migrations create tables, indexes and
   enums, so the role needs full rights on that database).
2. Set `DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require` (check your
   provider's TLS requirements).
3. In `docker-compose.yml` delete the `db` service, its `db-data` volume and the `db:` block
   under `app.depends_on`. `POSTGRES_*` are then unused.
4. `docker compose up -d`.

### Lightweight: local disk instead of an object store

Good for small installations and trials. Files are written to a directory inside the app
container, which the Compose file already maps to the `app-storage` volume.

1. In `.env` set `STORAGE_DRIVER=local` (and leave `LOCAL_STORAGE_PATH=./storage`). The `S3_*`
   variables are ignored.
2. In `docker-compose.yml` remove the `garage` service, its volumes and the `garage:` block
   under `app.depends_on`, as in the external-S3 variant.
3. Optional: use a host directory instead of the named volume so you can back it up with your
   usual tools. Replace `app-storage:/app/storage` under `app.volumes` with
   `./storage:/app/storage` and make it writable for the container user (UID 1000):
   `mkdir -p storage && sudo chown 1000:1000 storage`.
4. `docker compose up -d`.

Local storage ties the files to that one host and container; prefer S3 when you run more than
one instance or want provider-side replication.

### Using a published image instead of building

Set `TRUSTING_IMAGE=ghcr.io/z-brenner/trusting:<tag>` in `.env` and run `docker compose pull app`
before `docker compose up -d`. Compose only builds when the image cannot be pulled.

## Day-to-day operations

**Change settings** - edit `.env`, then `docker compose up -d`. Only containers whose
configuration changed are recreated.

**Read logs** - `docker compose logs -f app` (add `db` or `garage` as needed). The app logs
requests errors and the entrypoint's migration output; it never logs secrets or document
contents.

**Run migrations by hand** - `docker compose run --rm app migrate` applies pending migrations and
exits; combine with `SKIP_MIGRATIONS=true` in `.env` if you do not want the running container to
migrate on its own.

**Open a shell** - `docker compose exec app sh` (the container runs as the unprivileged `node`
user; the application lives in `/app`, the migration toolkit in `/opt/prisma`).

**Stop / remove** - `docker compose stop` keeps everything; `docker compose down` removes the
containers but keeps the volumes; `docker compose down -v` also deletes **all data**.

**Where is my data?** - `docker volume ls | grep trusting`: `db-data` (database), `garage-meta`
+ `garage-data` (files), `app-storage` (files when using the local driver). Back them up as
described in `docs/backup-restore.md`.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| `app` keeps restarting, log says `Invalid environment configuration: ...` | A variable in `.env` is missing or malformed; the message names it. |
| `SESSION_SECRET still has its development value` | You copied the development values; generate real secrets. |
| `STORAGE_DRIVER=s3 requires S3_BUCKET, ...` | Fill in the S3 variables or switch to `local`. |
| `database at db:5432 not reachable after 60s` | `db` is unhealthy (check `docker compose logs db`), or you pointed `DATABASE_URL` at an external host that is not reachable from the container. |
| Login page reloads without signing you in | The site is served over plain HTTP in production; cookies are `Secure`. Use HTTPS (or `localhost`). |
| Upload fails with 413 | The reverse proxy body limit is below `MAX_UPLOAD_MB`. |
| Upload fails with a storage error | Garage not healthy, wrong `S3_*` values, or the key format (`GK` + 24 hex) was not respected on first start. Check `docker compose logs garage`. Note that Garage only creates the key and bucket on its **first** start; to change them later use the `garage` CLI (`docker compose exec garage /garage key list`) or recreate the `garage-*` volumes on a fresh installation. |
