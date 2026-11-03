# TeamFlow — Multi-Tenant Project Management SaaS

[![CI](https://github.com/ayanirfan099/teamflow-collaboration/actions/workflows/ci.yml/badge.svg)](https://github.com/ayanirfan099/teamflow-collaboration/actions/workflows/ci.yml)

A full-stack collaboration platform with tenant-scoped authorization, Kanban workflows, authenticated real-time updates, attachments, audit history and accessible keyboard alternatives.

> **Portfolio status:** `v1.0.0` is released and immutable. TeamFlow is implemented and locally/CI verified with fictional data, but it has no verified public deployment and is not presented as production-approved.

## Product tour

| Project board                                                | Task details                                                     | Personal work queue                                                |
| ------------------------------------------------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------ |
| ![Seeded TeamFlow project board](docs/screenshots/board.png) | ![Seeded TeamFlow task dialog](docs/screenshots/task-dialog.png) | ![Seeded TeamFlow My Work dashboard](docs/screenshots/my-work.png) |

These are real Playwright captures from a freshly migrated PostgreSQL database. Capture uses fixed fictional data and time, waits for independently loaded UI state, and treats only imperceptible one-channel rendering noise as visually equivalent. CI verifies the images and uploads them as an artifact; it never commits or pushes screenshot changes.

## Why this project matters

TeamFlow demonstrates the difficult parts of collaborative SaaS beyond basic CRUD:

- tenant boundaries are enforced on the server for tasks, attachments, organization resources and WebSocket rooms;
- roles map to capabilities in one policy layer instead of scattered controller checks;
- task moves use sparse ordering and optimistic concurrency;
- sessions are opaque, stored as hashes and carried in `HttpOnly` cookies;
- real-time connections authenticate the session and re-authorize requested rooms;
- attachment downloads re-check membership and force download instead of inline rendering;
- keyboard-accessible move controls complement drag and drop.

## Architecture

| Layer           | Technology and responsibility                                                        |
| --------------- | ------------------------------------------------------------------------------------ |
| Web             | Next.js 15 App Router, React, TanStack Query and accessible shared UI components     |
| API             | NestJS 11 REST API, Socket.IO gateway, authorization policy and operational controls |
| Data            | PostgreSQL 17, Prisma client, checked-in SQL migrations and tenant-scoped models     |
| Shared packages | Zod contracts, generated database client, ordering helpers and UI primitives         |
| Verification    | Vitest, API integration tests, Playwright journeys and GitHub Actions                |

Request flow:

    Browser → Next.js web → same-origin REST proxy → NestJS API → PostgreSQL
                      ↘ authenticated Socket.IO connection ↗
                                      ↘ local or S3-compatible storage

Redis is not required for the single-API-instance topology. Multiple API instances need an external Socket.IO adapter and coordinated rate limiting; those adapters are not implemented in this repository.

## Capabilities

- Organizations with owner, admin, member and viewer roles
- Projects, boards, columns, tasks, labels, priorities, due dates and assignees
- Drag-and-drop plus a keyboard-accessible “Move to…” workflow
- Search, filters, My Work, activity history and administrative audit records
- Comments, mentions, notifications and ephemeral task presence
- Session revocation, CSRF checks, request IDs, rate limiting and health probes
- Attachment allowlists, signature checks, random storage keys and authorized downloads
- Local and S3-compatible storage drivers
- Responsive journeys and automated accessibility checks

## Local quick start

Requirements: Node.js 22+, npm, and PostgreSQL 17+ or Docker.

### Docker Compose

    cp .env.example .env
    # Replace every placeholder secret privately; never commit or print the file.
    docker compose -f infra/docker-compose.yml up --build

The web application is served at `http://localhost:3000` and the API at `http://localhost:4000`.

### Without Docker

    npm ci --no-audit --no-fund
    npm run db:generate
    # Configure DATABASE_URL and runtime secrets privately.
    npm run db:migrate
    npm run db:seed
    npm run dev

The seed creates a resettable workspace containing fictional users, a project, columns and tasks. Local fixture credentials remain development-only and must never be reused or published as shared-environment credentials.

## Verification

| Area                | Coverage                                                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Static quality      | Prettier, ESLint, strict TypeScript checks and production builds                                                              |
| Contracts/database  | Schema parsing, mention handling and sparse-ordering behavior                                                                 |
| API integration     | Sessions, organizations, tasks, collaboration, attachments, rate limits and real-time authorization                           |
| Browser             | Authentication, board workflows, complete collaboration journey, mobile layout and accessibility                              |
| Security boundaries | Cross-tenant task denial, attachment non-disclosure/download checks, authenticated organization rooms and rejected room joins |
| Screenshots         | Two fresh-database captures with stable seeded state and CI artifact verification                                             |

Exact commands, test counts, release evidence, screenshot hashes, authorization coverage and branch-protection recommendations are recorded in [`docs/VERIFICATION.md`](docs/VERIFICATION.md).

## Deployment boundary

No hosted URL has been verified. The repository contains Dockerfiles, Compose configuration, migrations, health endpoints and an operations runbook—not proof of a live environment.

A shared demo must use only fictional disposable data, block public registration and invitation creation, prevent unrestricted attachment mutations, enforce edge and application rate limits, and reset its database and storage on a schedule. See [`docs/deployment.md`](docs/deployment.md).

## Documentation

- [Verification record](docs/VERIFICATION.md)
- [Deployment and public-demo guidance](docs/deployment.md)
- [Architecture](docs/architecture.md)
- [Product requirements](docs/product-requirements.md)
- [API conventions](docs/api-conventions.md)
- [Threat model](docs/threat-model.md)
- [Benchmarks and measurement limits](docs/benchmarks.md)
- [Explicit v1 limitations](docs/out-of-scope.md)
- [Architecture decision records](docs/adr)
- [Changelog](CHANGELOG.md)

## License

No open-source license is granted for this repository. The source is published for portfolio review; reuse, redistribution or derivative use requires explicit permission from the repository owner.
