# 0008 — Rust-free Prisma client and a hand-written SQL migration runner

- **Status:** Accepted
- **Date:** 2026-11-01

## Context

Prisma is used as the query builder and as the single source of truth for the database schema.
Two properties of the default setup are problematic in this environment and in CI:

1. The Prisma CLI downloads **native engines** (`libquery_engine`, `schema-engine`) from
   `binaries.prisma.sh` when the client is generated. In a locked-down build environment
   (air-gapped CI, restricted egress) that download fails and the build cannot produce a client.
2. `prisma migrate` needs the same native schema engine plus a shadow database to compute the
   migration SQL. The migrations are executed by the application itself in the deployment
   pipeline, where a shadow database is not available.

## Decision

**Use the Rust-free `prisma-client` generator and apply plain SQL migrations with a small
runner of our own.**

### Generator

```prisma
generator client {
  provider    = "prisma-client"
  output      = "../src/generated/client"
  engineType  = "client"
}
```

- The query compiler runs as **WebAssembly inside Node**, so no native engine has to be
  downloaded or compiled.
- At runtime the client talks to Postgres through the **driver adapter** `@prisma/adapter-pg`
  (the `pg` driver). The adapter is configured with the schema of the connection string, so the
  generated queries qualify their tables correctly.
- The generated client is written to `packages/database/src/generated/client` and is **not**
  committed — it is build output. `npm run db:generate` recreates it.

Because the CLI still resolves the engine paths before it reads the schema, the generation is
invoked with the engine binaries stubbed out:

```bash
PRISMA_SCHEMA_ENGINE_BINARY=/bin/true PRISMA_QUERY_ENGINE_LIBRARY=/bin/true \
  npx prisma generate --schema packages/database/prisma/schema.prisma
```

The stub is only a path — the Rust-free client never executes it.

### Migrations

- Migrations are plain SQL files in `packages/database/prisma/migrations/<timestamp>_init/migration.sql`.
- `packages/database/src/migrate.ts` applies every migration that has not been applied yet:
  it creates the `_migrations` table, stores the **SHA-256 checksum** of each applied file and
  refuses to continue when a file was changed after it was applied.
- Each migration runs inside a transaction, so a failing migration leaves the schema untouched.
- The runner is exposed as a CLI (`packages/database/dist/cli/migrate.js`) and is used by the
  Docker Compose stack and by the CI pipeline before the API starts.

## Alternatives considered

- **The default `prisma-client-js` generator with native engines** — rejected: it needs the
  engine download and a platform specific binary in every runtime image.
- **`prisma migrate dev` / `prisma migrate deploy`** — rejected: both need the native schema
  engine; `deploy` additionally expects a shadow database for the diffing step and cannot run
  inside the application image.
- **A migration tool such as `node-pg-migrate` or `Knex`** — viable, but it adds a second
  schema definition next to `schema.prisma`. One schema and one migration format is easier to
  review.

## Consequences

- The build works without network access to `binaries.prisma.sh`.
- The runtime image contains no native Prisma binary, only the WebAssembly compiler and the
  `pg` driver.
- The schema is still defined in `schema.prisma` — it is the source of truth for the generated
  client. The SQL migrations are written by hand and have to be kept in sync with the schema; the
  checksum of an applied migration protects against silent changes.
- `prisma db pull` (which would need the schema engine) is not available offline; the schema is
  maintained in the repository.
