# 0003 — Application-layer tenant isolation

- **Status:** Accepted
- **Date:** 2026-11-01

## Context

Every organization-owned record must be invisible to users of other organizations. The two
possible strategies are database row-level security (RLS) per tenant and application-layer
scoping.

## Decision

**Application-layer scoping, enforced in every query.**

- Every tenant-owned table has a non-null `organizationId` column, and composite indexes start
  with `organizationId`.
- The API resolves the caller's membership for the requested organization _before_ the service
  runs, and hands the service a `TenantContext { organizationId, role, userId }`.
- Repositories take the tenant context as a required argument; there is no "find by id only"
  helper for tenant-owned models. A cross-tenant identifier therefore yields `404`, not `403`,
  so the API does not confirm the existence of another tenant's resource.
- Automated tests assert isolation for every major resource: projects, boards, columns, tasks,
  comments, attachments, activity, notifications, audit events and the real-time channels.

## Alternatives considered

- **Postgres row-level security** — attractive, but requires per-request `SET LOCAL app.tenant_id`
  on a pooled connection, which is easy to get wrong (missing `SET LOCAL` silently disables the
  policy). Deferred to a post-v1 hardening milestone; the application-layer guarantee is the
  primary control.
- **A separate database per organization** — strongest isolation, but operationally heavy and it
  breaks cross-organization reporting and the shared seed.

## Consequences

- Developers must pass the tenant context explicitly; the type system enforces it.
- A missed scope is a data leak, so the isolation test suite is part of CI and is expected to fail
  loudly if a repository drops its `organizationId` filter.
