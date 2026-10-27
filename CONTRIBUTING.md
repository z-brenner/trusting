# Contributing to Trusting

Thanks for helping make Trust Centers available to every team. This document covers how to set up
a development environment, how we work, and what we expect from a pull request.

## Development setup

Requirements: Node.js 22, pnpm 10 (`corepack enable` or `npm i -g pnpm@10`), PostgreSQL 16
reachable from your machine, and `psql` on your PATH (the unit tests use it to create their
database).

```sh
git clone https://github.com/z-brenner/trusting.git
cd trusting
pnpm install

cp .env.example .env
# Point DATABASE_URL at your local PostgreSQL, keep STORAGE_DRIVER=local for development,
# and fill SESSION_SECRET / ENCRYPTION_KEY (openssl rand -hex 32).

pnpm db:migrate      # creates/updates the database and regenerates the Prisma client
pnpm dev             # http://localhost:3000 -> /setup creates the first administrator
```

Useful scripts (see `package.json`):

| Command | What it does |
| --- | --- |
| `pnpm dev` | Next.js dev server with hot reload |
| `pnpm lint` / `pnpm typecheck` | ESLint, `tsc --noEmit` (TypeScript strict) |
| `pnpm test` | Vitest unit tests (uses database `trustcenter_test`) |
| `pnpm test:e2e` | Playwright end-to-end tests (own dev server on port 3300, database `trustcenter_e2e`) |
| `pnpm db:migrate` | `prisma migrate dev`: create a migration from schema changes |
| `pnpm db:deploy` | `prisma migrate deploy`: apply existing migrations (what the Docker image does at start) |
| `pnpm db:studio` | Browse the database |
| `pnpm build` | Production build (`prisma generate && next build`) |

Read `docs/ARCHITECTURE.md` first; it explains the draft/publish model, the document access rules
and where things live. `docs/DESIGN.md` describes the visual language.

## How we work

- **Issues first for anything non-trivial.** Open an issue (bug or feature template) so we can
  agree on the approach before you invest time. Small fixes can go straight to a PR.
- **Branches.** Branch from `main`; name branches `feat/<topic>`, `fix/<topic>`, `docs/<topic>`.
- **Commits.** Short imperative subject line ("Add OneDrive folder picker"), body explains *why*
  when it is not obvious. No sign-off / DCO is required.
- **Pull requests.** One topic per PR, fill in the template, keep the diff reviewable. CI must be
  green (lint, typecheck, unit tests, production build). A maintainer reviews and merges with a
  squash.
- **Breaking changes** to the database schema, environment variables or the public page need a
  note in the PR and in the release notes, plus updated docs (`docs/configuration.md`,
  `docs/upgrade.md`, `.env.example`).

## Code style

- TypeScript with `strict` on. No `any` unless there is a comment explaining why.
- ESLint (`eslint-config-next`) is the source of truth; run `pnpm lint` before pushing.
- Server code lives in `src/lib`; admin mutations are Server Actions in `src/lib/actions`;
  route handlers (`src/app/api`) are for multipart uploads, streaming and public forms, and must
  call `assertSameOrigin()` plus a rate limit when they mutate state.
- Validate every input with zod (`src/lib/validation.ts`). Never trust a client-declared MIME type
  or file name.
- UI uses the primitives in `src/components/ui` and the Tailwind tokens from `docs/DESIGN.md`
  (`canvas`, `surface`, `line`, `ink`, `accent`, status colours). Do not introduce raw hex colours
  or new fonts. Every interactive element needs a visible focus ring and at least 4.5:1 contrast.
- Status language stays honest: a framework badge always carries its status label; nothing may
  imply certification unless the administrator chose *Certified*.
- Audit anything sensitive with `audit()` and add a label to `AUDIT_LABELS`.

## Adding vendors and frameworks

The subprocessor directory and the compliance framework catalogue are plain TypeScript data in
`src/data/`:

- `src/data/vendors.ts` - common subprocessors (name, website, privacy policy URL, typical
  services, hosting locations). Keep entries factual and link to the vendor's own pages.
- `src/data/frameworks.ts` - frameworks and standards (slug, name, short name, kind, description,
  optional detail fields). Check `frameworkBySlug` consumers before renaming a slug: slugs are
  stored in the database.
- `src/data/locations.ts`, `countries.json`, `data-categories.ts`, `document-categories.ts` -
  pick lists used by the editor and the public page (document category list also drives the
  MIME allow-list for uploads).

Additions are welcome as small, focused PRs. Please avoid marketing language and do not add
vendors whose details you cannot verify from a public source.

## Writing tests

- Unit tests live in `tests/unit/*.test.ts` (Vitest, Node environment). They may use the
  database; `tests/unit/global-setup.ts` creates `trustcenter_test` and applies migrations.
  Keep tests independent of each other (`fileParallelism` is off, but do not rely on order).
- End-to-end tests live in `tests/e2e` (Playwright). They start their own dev server and mock the
  Google/Microsoft OAuth endpoints, so they need no external credentials.
- A bug fix should come with a test that fails before the fix. New security-relevant code paths
  (authorization, token handling, uploads) need tests.

## Documentation

User-facing documentation lives in `README.md` and `docs/`. If your change affects how operators
install, configure or upgrade Trusting, update the relevant page in the same PR.

## Licence of contributions

Trusting is licensed under the Apache License 2.0 (see `LICENSE`). By submitting a contribution
you agree that it is licensed under the same terms, as described in section 5 of the licence
("Submission of Contributions"). No separate CLA or sign-off is required.

## Reporting security issues

Please do not open public issues for vulnerabilities. Follow the process in `SECURITY.md`.
