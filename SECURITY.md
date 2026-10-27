# Security policy

Trusting is a self-hosted application that handles confidential documents (audit reports,
penetration tests, DPAs). We take reports seriously and appreciate responsible disclosure.

## Supported versions

| Version | Supported |
| --- | --- |
| Latest release (`main` / newest tag) | Yes |
| Older tags | No, please upgrade (see `docs/upgrade.md`) |

Security fixes are released as a new version with a note in the release changelog. We do not
backport.

## Reporting a vulnerability

- Preferred: use **GitHub private vulnerability reporting** on this repository
  ("Security" tab -> "Report a vulnerability").
- Alternatively email **security@example.com** (replace with the maintainers' address). If you
  need to encrypt, ask for a PGP key in your first message.

Please include: affected version or commit, steps to reproduce, impact, and whether the issue
is already public. You will get an acknowledgement within 3 working days and a status update at
least every 14 days until the issue is resolved. We will credit you in the release notes unless
you prefer otherwise.

Please do not run scanners or exploits against installations you do not own: use your own
`docker compose up` instance.

## Scope

In scope:

- The application in this repository (`src/`), its Docker image and Compose stack, and the
  documentation where it gives security-relevant advice.
- Authentication and session handling, document authorization and download links, access
  requests, file upload handling, integrations (Google Drive / OneDrive OAuth and token storage),
  CSRF/SSRF/injection issues, information leaks between draft and published content.

Out of scope:

- Vulnerabilities in third-party services you connect (your PostgreSQL, S3 provider, SMTP
  server, Google/Microsoft) or in the reverse proxy you choose.
- Issues that require a compromised administrator account or host, or non-default insecure
  configuration explicitly warned against in the docs (for example running without TLS).
- Rate limits being per-instance (documented behaviour, see below).

## Security design summary

A short description of the mechanisms as implemented; details are in `docs/ARCHITECTURE.md` and
the code under `src/lib`.

**Administrators and sessions**

- Passwords are hashed with scrypt (N = 2^17, r = 8, p = 1, 16-byte salt, 64-byte key); input is
  NFKC-normalised. The first administrator is created at `/setup`; afterwards only existing
  administrators can add others.
- Sessions are random 256-bit tokens; only their SHA-256 hash is stored. The cookie is `httpOnly`,
  `SameSite=Lax`, `Secure` in production, 7-day lifetime with daily sliding renewal. Changing a
  password can revoke all other sessions.
- `/admin/*` is guarded twice: a lightweight edge check redirects anonymous visitors, and every
  page/action re-validates the session server-side (`requireAdmin()`).

**Cross-site request forgery**

- Admin mutations are Next.js Server Actions, which enforce a same-origin check.
- Route handlers that mutate state (uploads, public access-request form) call
  `assertSameOrigin()`, which rejects requests whose `Sec-Fetch-Site`/`Origin` do not match
  `APP_URL`. Set `APP_URL` to the exact public URL.

**Uploads**

- Admin-only, rate limited, size-limited (`MAX_UPLOAD_MB`, logos 2 MB).
- The type is detected from the file content (magic bytes), not the declared `Content-Type`,
  and checked against an allow-list. SVG logos are checked for scripts and event handlers.
- File names are sanitised; files are stored under random, server-generated keys in a private
  bucket or directory. Nothing is ever served directly from storage.

**Downloads and document visibility**

- Every download goes through `/api/files/[id]` with a 10-minute HMAC-signed token minted only
  after the server authorised the request. Authorisation is re-checked at download time.
- A document is visible to a visitor only when **both** the published snapshot and the current
  draft allow it: tightening visibility takes effect immediately, loosening requires publishing.
- Visibility states: `PUBLIC`, `REQUEST` (needs an approved access grant), `PRIVATE`
  (administrators only). Imported and uploaded documents default to `PRIVATE`.
- Access grants are random tokens (hash stored), expire (default 14 days, max 90), can be revoked,
  and are limited to the documents listed in the approved request.
- File responses are sent with `Content-Disposition: attachment` (inline only for PDFs when
  requested), `nosniff`, `Cache-Control: private, no-store` and a sandboxing CSP.

**Encryption and secrets**

- Integration tokens (Google, Microsoft) are encrypted with AES-256-GCM under `ENCRYPTION_KEY`
  before being stored. OAuth uses the server-side authorization-code flow with `state` and PKCE.
- `SESSION_SECRET` signs download and other short-lived tokens. Both secrets are validated at
  start; production refuses the development placeholders.
- Secrets never reach the browser; the application has no `NEXT_PUBLIC_` variables.

**Rate limiting**

- Login, setup, password change, access requests, uploads and downloads are rate limited per IP or
  per user with an in-memory sliding window. Trusting is designed to run as a single instance per
  organisation; with several replicas, add rate limits at your reverse proxy. Set
  `TRUST_PROXY=true` behind a proxy so limits apply to the real client IP.

**Audit log**

- Sign-ins (including failures), administrator changes, publishing, document changes and
  downloads, access-request decisions and integration (dis)connections are written to an audit
  log visible in the admin UI.

**HTTP hardening**

- Strict `Content-Security-Policy` (no third-party scripts, fonts or connections),
  `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`,
  `Permissions-Policy`; `X-Powered-By` is disabled. Inter is self-hosted, so no requests go to
  third parties from visitors' browsers.

## Hardening checklist for operators

- [ ] Serve over HTTPS only; set `APP_URL` to the `https://` URL and `TRUST_PROXY=true`
      (see `docs/deployment.md`). Session cookies are `Secure` in production and will not work
      over plain HTTP.
- [ ] Generate `SESSION_SECRET` and `ENCRYPTION_KEY` with `openssl rand -hex 32`; never reuse
      them between installations; back them up (`docs/backup-restore.md`).
- [ ] Use a strong database password and do not publish PostgreSQL or the object store on the
      host (the default Compose file does not).
- [ ] Keep the S3 bucket private (no public read policy). Trusting streams every download itself.
- [ ] Set `MAX_UPLOAD_MB` to what you actually need and mirror it in the proxy's body-size limit.
- [ ] Use dedicated OAuth apps for Google/Microsoft with the minimal scopes the docs list, and
      restrict them to your organisation where the provider allows it.
- [ ] Use an SMTP account dedicated to this application.
- [ ] Keep the image up to date (`docs/upgrade.md`); subscribe to release notifications.
- [ ] Back up the database, the object store and the `.env` file; test a restore.
- [ ] Review the audit log and pending access requests regularly; revoke grants that are no
      longer needed.
- [ ] Keep the number of administrators small; remove accounts of people who leave.
