# 0001 — Monorepo with npm workspaces

- **Status:** Accepted
- **Date:** 2026-11-01

## Context

The product has a Next.js frontend, a NestJS API and three shared packages (Prisma schema, shared
contracts, design system). The packages must be versioned together because the API and the web
client validate against the same contracts, and a contract change has to break both builds at
once.

## Decision

Use a single TypeScript monorepo managed by **npm workspaces**, with:

- `apps/api` — NestJS API, Socket.IO gateway, Jest integration tests.
- `apps/web` — Next.js App Router application, Vitest unit tests, Playwright journeys.
- `packages/database` — Prisma schema, migrations, seed, client factory.
- `packages/contracts` — Zod schemas and inferred types shared by API and web.
- `packages/ui` — accessible design-system primitives.

Each workspace owns its own `package.json` and `tsconfig.json` that extends a shared
`tsconfig.base.json`. The root exposes the aggregate scripts (`build`, `lint`, `typecheck`,
`test`).

## Alternatives considered

- **Separate repositories** — rejected: contracts would need publishing/versioning, and a contract
  change could break one side silently.
- **pnpm / yarn workspaces** — rejected for v1: npm ships with Node, so a clean checkout works
  with the toolchain the repository already documents. pnpm's store layout also complicates the
  Docker build context. This is reversible: workspaces are declared in a single root manifest.
- **Nx / Turborepo** — deferred: the repository is small enough that plain npm scripts plus
  TypeScript project references give the required build ordering without extra tooling.

## Consequences

- One `npm install` at the root installs everything.
- CI caches a single `node_modules` tree and can run workspace-scoped tasks.
- Publishing individual packages is not supported; this is an application monorepo, not a library
  registry.
