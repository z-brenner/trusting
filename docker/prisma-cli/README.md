# Migration toolkit

This folder is a tiny, self-contained Node project that the Docker image installs into
`/opt/prisma`. It exists so the runtime image can run `prisma migrate deploy` at container
start without shipping the application's full `node_modules`.

It pins the exact versions used by the main `package.json`:

- `prisma` (the CLI; it pulls in `@prisma/engines`, which downloads the schema engine binary
  for the image platform at install time)
- `@prisma/config` and `dotenv` (imported by `prisma.config.ts`)

The image copies `prisma.config.ts`, `prisma/schema.prisma` and `prisma/migrations` next to it,
and `docker/entrypoint.sh` runs `node node_modules/prisma/build/index.js migrate deploy` from this
directory.

When you bump Prisma in the root `package.json`, bump it here too and refresh the lockfile:

```sh
cd docker/prisma-cli && pnpm install --prod --lockfile-only
```
