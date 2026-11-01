# TeamFlow — Multi-Tenant Project Management SaaS

> Multi-tenant project-management platform with role-based access, Kanban workflows, authenticated
> real-time collaboration and audit trails.

**Status:** M0 (specification) complete. Implementation proceeds through documented milestones,
each delivered as a focused pull request.

---

## Documentation

| Document | Purpose |
| --- | --- |
| [`docs/product-requirements.md`](docs/product-requirements.md) | Personas, role/capability matrix, functional requirements, acceptance criteria |
| [`docs/architecture.md`](docs/architecture.md) | System context, repository layout, data model, request pipeline, ordering and real-time design |
| [`docs/api-conventions.md`](docs/api-conventions.md) | Envelopes, error codes, auth, pagination, filtering, concurrency, idempotency, rate limits, real-time protocol |
| [`docs/threat-model.md`](docs/threat-model.md) | Assets, trust boundaries, 17 threats with mitigations and the tests that verify them |
| [`docs/out-of-scope.md`](docs/out-of-scope.md) | What is deliberately *not* in v1 |
| [`docs/adr/`](docs/adr) | Architecture decision records (monorepo, sessions, tenancy, ordering, contracts, storage, hashing) |

---

## Planned delivery

| Milestone | Scope | State |
| --- | --- | --- |
| **M0** | Specification, architecture, threat model, ADRs | ✅ complete |
| **M1** | Monorepo, Docker Compose, Prisma migrations, NestJS + Next.js shell, sessions, organizations, seed, CI | ⏳ planned |
| **M2** | Projects, boards, columns, tasks, ordering, labels, search, tenant-isolation tests, responsive UI | ⏳ planned |
| **M3** | Comments, mentions, notifications, authenticated WebSocket rooms, activity timeline, concurrency | ⏳ planned |
| **M4** | Attachments, invitations and role administration, audit log, rate limiting, operational logging | ⏳ planned |
| **M5** | Playwright journeys, accessibility audit, responsive review, screenshots, deployment guide | ⏳ planned |

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

> Filled in as the implementation lands — see the milestone table above. The target commands are:
>
> ```bash
> npm install
> docker compose up -d postgres
> npm run db:migrate && npm run db:seed
> npm run dev            # API on :4000, web on :3000
> ```

---

## Limitations

The v1 limitations are tracked explicitly in [`docs/out-of-scope.md`](docs/out-of-scope.md):
password-only authentication, no email delivery, in-process rate limiting without Redis, and
attachment downloads streamed through the API. No hosted environment, uptime figure or performance
benchmark is claimed by this repository.
