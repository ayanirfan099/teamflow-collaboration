# 0005 — Zod contracts shared by API and web

- **Status:** Accepted
- **Date:** 2026-11-01

## Context

The frontend and the API must agree on request shapes, response shapes and error codes. Duplicated
TypeScript interfaces drift silently: the client is happy, the server returns something else.

## Decision

`packages/contracts` is the single source of truth. It exports:

- Zod schemas for every request body, query string and response payload.
- TypeScript types inferred from those schemas (`z.infer`).
- Shared enumerations (`TaskPriority`, `TaskStatus`, `MemberRole`, …) and constants.

Both sides consume the package:

- The API validates inputs with a custom NestJS pipe that uses the same schema and produces the
  documented `400 validation_failed` envelope. Responses are typed with `z.infer` at the
  controller boundary.
- The web app builds its fetch client and React Query hooks from the same schemas, so a contract
  change fails the type check on the client side as well.

## Alternatives considered

- **OpenAPI-generated clients** — rejected as the primary source: generation requires a running
  server or a committed spec file, which reintroduces drift between spec and implementation. The
  OpenAPI document is still generated _from_ the Zod contracts and published at `/api/v1/docs`.
- **Class-validator DTOs in NestJS** — rejected: decorators are not available to the frontend, so
  the types would still be duplicated.
- **TypeScript types only, no runtime validation** — rejected: types are erased at runtime, so the
  API would accept malformed input.

## Consequences

- The contracts package is the highest-churn package and must stay dependency-light (Zod only).
- Adding a field to a response is a two-line change: extend the schema, infer the type.
- Breaking changes must be versioned deliberately; v1 uses `/api/v1` and additive changes only.
