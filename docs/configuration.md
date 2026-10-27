# Configuration reference

Trusting is configured entirely through environment variables. With Docker Compose they live in
the `.env` file next to `docker-compose.yml` (start from `.env.example`). The application
validates them at start (`src/lib/env.ts`) and refuses to run with missing or malformed values;
the error message names the offending variable.

Generate secrets with:

```sh
openssl rand -hex 32          # SESSION_SECRET, ENCRYPTION_KEY, GARAGE_RPC_SECRET, S3 secret key
echo "GK$(openssl rand -hex 12)"   # S3_ACCESS_KEY_ID for the bundled Garage store
```

## Core

| Variable | Required | Default | Meaning |
| --- | --- | --- | --- |
| `APP_URL` | yes in production | `http://localhost:3000` | Public URL of the installation without trailing slash, e.g. `https://trust.example.com`. Used for links in emails, OAuth redirect URIs and the CSRF origin check. Must match what browsers use. |
| `DATABASE_URL` | yes | - | PostgreSQL connection string, e.g. `postgresql://trusting:PASSWORD@db:5432/trusting`. Append `?sslmode=require` for managed databases that require TLS. |
| `SESSION_SECRET` | yes | - | At least 32 characters; signs short-lived tokens (download links). `openssl rand -hex 32`. In production a value starting with `dev-` is rejected. |
| `ENCRYPTION_KEY` | yes | - | Exactly 64 hex characters (32 bytes); AES-256-GCM key for stored integration tokens. `openssl rand -hex 32`. In production an all-zero key is rejected. **Losing it makes connected integrations unrecoverable** (you reconnect them); back it up. |
| `TRUST_PROXY` | no | `false` | Set `true` behind a reverse proxy so the client IP is taken from `X-Forwarded-For` / `X-Real-IP` (rate limits, audit log). Never enable it when clients can reach the app directly. |
| `MAX_UPLOAD_MB` | no | `25` | Maximum document size in MB (positive integer). Logos are always limited to 2 MB. Mirror this in your reverse proxy's body-size limit (`docs/deployment.md`). |
| `NODE_ENV` | no | set to `production` by the image | Enables the production checks above and the `Secure` cookie flag (HTTPS required). |
| `PORT`, `HOSTNAME` | no | `3000`, `0.0.0.0` | Listening port and interface inside the container. The Compose health checks assume 3000. |

## File storage

| Variable | Required | Default | Meaning |
| --- | --- | --- | --- |
| `STORAGE_DRIVER` | no | `local` (`.env.example` sets `s3`) | `s3` for any S3-compatible service (bundled Garage, AWS S3, Cloudflare R2, Backblaze B2, Hetzner, Wasabi, MinIO...). `local` for a directory on disk. |
| `LOCAL_STORAGE_PATH` | with `local` | `./storage` | Directory for uploaded files, relative to the app's working directory (`/app` in the image, so `/app/storage`; the Compose file mounts a volume there). |
| `S3_ENDPOINT` | with `s3`, non-AWS | - | Base URL of the S3 API, e.g. `http://garage:3900` for the bundled store, `https://<account>.r2.cloudflarestorage.com` for R2. Leave empty for AWS S3. |
| `S3_REGION` | no | `us-east-1` | Signing region. The bundled Garage is configured for `us-east-1` (`docker/garage.toml`); AWS needs the bucket's region; many other providers accept any value or document a fixed one (R2: `auto`). |
| `S3_BUCKET` | with `s3` | - | Bucket name. Must exist and should be **private**; Trusting never hands out bucket URLs. With the bundled Garage the bucket is created automatically on first start. |
| `S3_ACCESS_KEY_ID` | with `s3` | - | Access key. For the bundled Garage it must have the form `GK` + 24 hex characters (`echo "GK$(openssl rand -hex 12)"`); Garage creates the key with this ID. |
| `S3_SECRET_ACCESS_KEY` | with `s3` | - | Secret key. For the bundled Garage: 64 hex characters (`openssl rand -hex 32`). |
| `S3_FORCE_PATH_STYLE` | no | `true` | Use `http://endpoint/bucket/key` URLs. Required by Garage (as configured), MinIO and most self-hosted stores; set `false` for AWS S3 if you prefer virtual-hosted style. |

## Email (optional)

Email is used to notify requesters when an access request is approved or rejected. Leave
`SMTP_HOST` empty to run without email: approvals then show the access link in the admin UI so you
can send it yourself.

| Variable | Default | Meaning |
| --- | --- | --- |
| `SMTP_HOST` | - | SMTP server host name. Empty disables email. |
| `SMTP_PORT` | `587` | `587` for STARTTLS, `465` for implicit TLS, `25` for unauthenticated relays. |
| `SMTP_USER`, `SMTP_PASSWORD` | - | Credentials. Leave `SMTP_USER` empty for relays that do not authenticate. |
| `SMTP_SECURE` | `false` | `true` for implicit TLS on connect (port 465). With `false` the connection upgrades with STARTTLS when the server offers it. |
| `SMTP_FROM` | - | Sender, e.g. `"Trust Center <trust@example.com>"`. Email is only enabled when both `SMTP_HOST` and `SMTP_FROM` are set. |

Examples:

```ini
# Generic provider with STARTTLS (Postmark, Mailgun, SES SMTP, Fastmail...)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=apikey-or-username
SMTP_PASSWORD=secret
SMTP_SECURE=false
SMTP_FROM="Trust Center <trust@example.com>"

# Implicit TLS on 465
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_SECURE=true

# Google Workspace with an app password
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=trust@example.com
SMTP_PASSWORD=xxxx xxxx xxxx xxxx
```

## Integrations (optional)

Both integrations let administrators import documents from a cloud drive. Each needs an OAuth
application that you create in the respective console; see `docs/integrations/google-drive.md`
and `docs/integrations/onedrive.md` for the step-by-step setup and the scopes involved. If the
variables are empty the integration is simply not offered in the admin UI.

| Variable | Meaning |
| --- | --- |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | OAuth client for Google Drive. Register the redirect URI `${APP_URL}/api/integrations/google/callback`. |
| `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` | App registration for OneDrive / SharePoint. Register the redirect URI `${APP_URL}/api/integrations/microsoft/callback`. |
| `MICROSOFT_TENANT` | `common` (default), `organizations`, `consumers` or a tenant ID to restrict sign-in to your directory. |

`GOOGLE_OAUTH_BASE_URL`, `GOOGLE_API_BASE_URL`, `MICROSOFT_OAUTH_BASE_URL` and
`MICROSOFT_GRAPH_BASE_URL` exist only so the test suite can point the integrations at mock
servers. Do not set them in production.

## Variables read by Docker Compose (not by the app)

These are interpolated into `docker-compose.yml` from the same `.env` file.

| Variable | Default | Meaning |
| --- | --- | --- |
| `POSTGRES_USER` | `trusting` | Database role created by the `db` service. Must match the user in `DATABASE_URL`. |
| `POSTGRES_PASSWORD` | required | Password for that role. Must match the password in `DATABASE_URL`. |
| `POSTGRES_DB` | `trusting` | Database name. Must match the database in `DATABASE_URL`. |
| `GARAGE_RPC_SECRET` | required with the bundled store | Internal secret of the Garage node, 64 hex characters (`openssl rand -hex 32`). Not used by the app. |
| `TRUSTING_IMAGE` | `ghcr.io/z-brenner/trusting:latest` | Image to run; Compose falls back to building the `Dockerfile` when the image is not available. Pin a tag here when upgrading deliberately. |
| `TRUSTING_PORT` | `3000` | Host port the app is published on. |

Changing `POSTGRES_*` after the first start does not change the existing database; see
PostgreSQL's documentation (or recreate the volume on a fresh installation).

## Variables read by the container entrypoint

| Variable | Default | Meaning |
| --- | --- | --- |
| `SKIP_MIGRATIONS` | `false` | `true` skips `prisma migrate deploy` at start. Use when you run `docker compose run --rm app migrate` yourself (several replicas, restricted database roles). |
| `DB_WAIT_SECONDS` | `60` | How long to wait for the database host to accept connections before giving up. |

## Applying changes

After editing `.env` run `docker compose up -d`. Compose recreates the containers whose
environment changed; the app restarts in a few seconds. Secrets rotated this way take effect
immediately: a new `SESSION_SECRET` invalidates outstanding download links, a new
`ENCRYPTION_KEY` makes previously stored integration tokens unreadable (reconnect the
integrations afterwards).
