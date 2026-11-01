# 0002 — Session cookies over bearer tokens

- **Status:** Accepted
- **Date:** 2026-11-01

## Context

The API is consumed by a browser application. Token-based auth (JWT in `localStorage`) is easy to
implement but turns any XSS into a full account takeover, and JWTs cannot be revoked server-side
before their expiry.

## Decision

Use **opaque server-managed sessions** stored in Postgres:

1. Sign-in creates a 32-byte random token, base64url encoded.
2. The client receives it as `tf_session` — `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` in
   production.
3. The database stores only `sha256(token)`, together with expiry, user agent, IP and
   `revokedAt`.
4. Every request looks the session up by hash. Revocation takes effect on the next request and
   immediately for live sockets (the gateway re-checks the session on each heartbeat and on
   `room:join`).
5. "Sign out everywhere" revokes every session of the user.

CSRF protection is a **session-bound double-submit token**: the CSRF cookie value is stored as a
hash on the session row and must be echoed in the `x-csrf-token` header.

## Alternatives considered

- **JWT access + refresh tokens** — rejected: revocation requires a denylist, which reintroduces
  server-side state, and the refresh token still has to live somewhere in the browser.
- **Redis-only sessions** — rejected: sessions must be revocable across API restarts and
  independently auditable; Postgres gives both, and the dataset is small.
- **SameSite=Strict only, no CSRF token** — rejected: `Strict` breaks legitimate cross-site
  navigation to invitation links, and relying on `SameSite` alone is not sufficient for
  `SameSite=None` deployments.

## Consequences

- Every request costs one indexed database lookup (the session hash is a unique index).
- Horizontal scaling needs no sticky sessions because the session state lives in the database.
- Cross-origin deployments must use `SameSite=None; Secure`, which requires HTTPS — documented in
  the deployment guide.
