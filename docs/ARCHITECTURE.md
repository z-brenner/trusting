# Architecture

Trusting is a single Next.js 16 application (App Router, TypeScript) backed by PostgreSQL
(Prisma 7) and an S3-compatible or local object store. One installation serves one organisation.

```
src/
  app/
    page.tsx                 Public Trust Center (renders the *published* snapshot)
    access/                  Access-request and grant pages for visitors
    setup/, login/           First-run setup and sign-in
    admin/                   Administrator UI (requires session)
      page.tsx               Dashboard
      edit/[step]/           Guided 6-step builder
      documents/, requests/, integrations/, settings/, activity/
    api/
      files/[id]/            Authorised, time-limited document streaming
      logo/                  Public logo
      uploads/               Document and logo uploads (multipart)
      integrations/          OAuth start/callback + file browsing for Drive/OneDrive
      access-requests/       Public access-request submission
      preview/               Admin-only draft preview rendering
  components/
    ui/                      Design-system primitives (see docs/DESIGN.md)
    admin/, editor/, public/ Feature components
  lib/
    env.ts                   Validated environment (zod)
    db.ts                    Prisma client (pg driver adapter)
    auth.ts                  Sessions (opaque token, hashed in DB, httpOnly cookie)
    crypto.ts                scrypt passwords, AES-256-GCM secrets, HMAC signed tokens
    rate-limit.ts            In-memory sliding window limiter for sensitive endpoints
    request.ts               Client IP, same-origin (CSRF) assertion for route handlers
    audit.ts                 Audit log writer
    storage/                 StorageDriver interface, local + S3 drivers
    snapshot.ts              Draft -> immutable Publication snapshot; publish/unpublish
    documents/access.ts      Visibility rules, grants, signed download URLs
    validation.ts            zod schemas shared by actions and route handlers
    actions/                 Server Actions (admin mutations)
    integrations/            Google Drive + OneDrive OAuth and API clients
  data/                      Vendor directory, framework catalog, countries, categories
prisma/                      Schema and migrations
tests/unit, tests/e2e        Vitest and Playwright
```

## Key decisions

- **Draft vs. published.** Administrators edit a draft (relational tables). Publishing writes a JSON
  snapshot into `Publication` and points `TrustCenter.currentPublicationId` at it. The public page
  only reads the snapshot. Unpublishing clears the pointer; history is kept.
- **Documents never leak.** Files live under random keys in private storage. Every download is
  streamed through `/api/files/[id]` with a 10-minute HMAC token, and authorization is re-checked
  at download time (public visibility in *both* draft and snapshot, or an active grant cookie, or an
  admin session). Imported documents default to private.
- **Mutations.** Admin writes use Server Actions (Next.js enforces same-origin for them). Multipart
  uploads and public forms use route handlers guarded by `assertSameOrigin()` plus rate limits.
- **Secrets.** Integration tokens are encrypted with AES-256-GCM under `ENCRYPTION_KEY` before they
  are stored. OAuth uses server-side authorization-code flow with `state` and PKCE.
- **No proprietary services required.** PostgreSQL + (MinIO | any S3) + SMTP (optional) is all you
  need. Google/Microsoft integrations are optional and use OAuth apps you own.
