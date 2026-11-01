# TeamFlow — Multi-Tenant Project Management SaaS

> Multi-tenant project-management platform with role-based access, Kanban workflows, authenticated
> real-time collaboration and audit trails.

**Status:** M1–M3 implemented (foundation, workspaces, boards and collaboration). M4–M5 are
planned; the remaining gaps are listed in [`docs/out-of-scope.md`](docs/out-of-scope.md).

---

## Documentation

| Document                                                       | Purpose                                                                                                                     |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| [`docs/product-requirements.md`](docs/product-requirements.md) | Personas, role/capability matrix, functional requirements, acceptance criteria                                              |
| [`docs/architecture.md`](docs/architecture.md)                 | System context, repository layout, data model, request pipeline, ordering and real-time design                              |
| [`docs/api-conventions.md`](docs/api-conventions.md)           | Envelopes, error codes, auth, pagination, filtering, concurrency, idempotency, rate limits, real-time protocol              |
| [`docs/threat-model.md`](docs/threat-model.md)                 | Assets, trust boundaries, 17 threats with mitigations and the tests that verify them                                        |
| [`docs/out-of-scope.md`](docs/out-of-scope.md)                 | What is deliberately _not_ in v1                                                                                            |
| [`docs/adr/`](docs/adr)                                        | Architecture decision records (monorepo, sessions, tenancy, ordering, contracts, storage, hashing, Rust-free Prisma client) |
| [`infra/README.md`](infra/README.md)                           | The Docker Compose stack and the local setup without Docker                                                                 |

---

## Repository layout

```
apps/
  api/       NestJS 11 API — REST under /api/v1, Socket.IO under /socket.io
  web/       Next.js 15 (App Router) web application
packages/
  contracts/ Shared Zod schemas and types
  database/  Prisma schema, generated client, SQL migrations, ordering helpers
  ui/        Accessible design-system primitives
docs/        Specification, architecture, threat model, ADRs
infra/       Docker Compose stack and the Dockerfiles
```

npm workspaces (see [ADR 0001](docs/adr/0001-monorepo-npm-workspaces.md)).

---

## Delivery

| Milestone | Scope                                                                                                    | State             |
| --------- | -------------------------------------------------------------------------------------------------------- | ----------------- |
| **M0**    | Specification, architecture, threat model, ADRs                                                          | ✅ merged (PR #1) |
| **M1**    | Monorepo, Prisma schema and SQL migrations, NestJS + Next.js shell, sessions, organizations, seed, CI    | ✅ PR #2          |
| **M2**    | Projects, boards, columns, tasks, sparse ordering, labels, search, tenant-isolation tests, responsive UI | ✅ PR #2          |
| **M3**    | Comments, mentions, notifications, authenticated WebSocket rooms, activity timeline, concurrency         | ✅ PR #2          |
| **M4**    | Attachments, invitations and role administration, audit log UI, rate limiting, operational logging       | ⏳ planned        |
| **M5**    | Playwright journeys, accessibility audit, responsive review, screenshots, deployment guide               | ⏳ planned        |

---

## Principles

- **Tenant isolation by construction.** Every organization-owned row carries `organizationId`, and
  every query is scoped by it. Cross-tenant identifiers resolve to `404`, never to data.
- **Server-managed sessions.** Opaque tokens in `HttpOnly` cookies, hashed at rest, individually and
  globally revocable. No long-lived tokens in browser storage.
- **One authorization matrix.** Roles (owner / admin / member / viewer) map to capabilities in a
  single policy module; controllers never compare roles ad hoc.
- **Honest artifacts.** No invented test results, users, deployments or performance claims. What
  is not built is listed in [`docs/out-of-scope.md`](docs/out-of-scope.md).
- **Reviewable increments.** Each milestone is a focused pull request with its own commands,
  results, risks and follow-ups.

---

## Quick start

### With Docker

```bash
cp .env.example .env          # set SESSION_SECRET
docker compose -f infra/docker-compose.yml up --build
```

The web app is served on <http://localhost:3000>, the API on <http://localhost:4000>.

### Without Docker

The repository ships the PostgreSQL binaries of `@embedded-postgres/linux-x64`, so the whole stack
runs without a container runtime:

```bash
npm install
npm run db:generate            # Prisma client (Rust-free, see ADR 0008)
npm run db:local               # starts a throwaway Postgres and prints a DATABASE_URL
export DATABASE_URL="postgresql://postgres@127.0.0.1:<port>/teamflow?schema=public"
npm run db:migrate             # applies the SQL migrations
npm run build:packages
npm run dev                    # API on :4000, web on :3000
```

`npm run db:seed` creates a demo organization ("Northwind Studio"), a project with a board,
columns and a few tasks. The seed is deterministic and uses fictional accounts
(`ada@teamflow.dev`, `grace@teamflow.dev`, `alan@teamflow.dev`, password `TeamFlow!2026`) — no
real person or customer data.

---

## Commands

| Command                | Purpose                                                               |
| ---------------------- | --------------------------------------------------------------------- |
| `npm run build`        | Builds contracts, database, ui, api and web                           |
| `npm run typecheck`    | Type checks every workspace                                           |
| `npm run lint`         | ESLint (flat config) over the repository                              |
| `npm run format:check` | Prettier check                                                        |
| `npm test`             | Jest (API integration tests) and Vitest (web and database unit tests) |
| `npm run test:e2e`     | Playwright journeys against a running stack                           |
| `npm run db:generate`  | Regenerates the Prisma client                                         |
| `npm run db:migrate`   | Applies the pending SQL migrations                                    |
| `npm run db:seed`      | Seeds the demo data                                                   |
| `npm run db:local`     | Starts the embedded Postgres                                          |

### Test status

| Suite           | Command                                       | Result                     |
| --------------- | --------------------------------------------- | -------------------------- |
| API integration | `npm run test --workspace @teamflow/api`      | 4 suites, 32 tests passing |
| Web unit        | `npm run test --workspace @teamflow/web`      | 2 files, 14 tests passing  |
| Database unit   | `npm run test --workspace @teamflow/database` | 1 file, 10 tests passing   |
| End to end      | `npm run test:e2e`                            | 3 tests passing in CI      |

The Playwright specs run in the CI workflow against a real stack (Postgres, API and web app).
They are **not** executed in the development sandbox, because no browser binary is installed
there.

---

## Design notes

- **Warm, neutral palette with a single accent.** The UI uses one terracotta accent on a warm
  neutral background; status colours are reserved for state, never for decoration.
- **The board works without a pointer.** Tasks can be dragged, and every card additionally offers
  a "Move to…" menu, so the board is fully operable with the keyboard.
- **Optimistic updates roll back.** A task move updates the cache immediately and restores the
  previous state when the request fails.
- **The browser stays on its own origin.** The Next server proxies `/api/v1/*` to the API, so the
  session cookie is always first-party. The WebSocket handshake goes to the API directly and is
  authorised with the same session cookie.

---

## Limitations

The v1 limitations are tracked explicitly in [`docs/out-of-scope.md`](docs/out-of-scope.md):
password-only authentication, no email delivery, in-process rate limiting without Redis, and
attachment downloads streamed through the API. No hosted environment, uptime figure or performance
benchmark is claimed by this repository.
