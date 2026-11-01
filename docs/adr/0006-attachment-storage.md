# 0006 — Storage abstraction for attachments

- **Status:** Accepted
- **Date:** 2026-11-01

## Context

Attachments must work in local development without any cloud account and must be able to move to
object storage in production without changing the API surface.

## Decision

Define a small `StorageAdapter` interface in `apps/api/src/modules/attachments/storage/`:

```ts
interface StorageAdapter {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<{ body: Buffer; contentType: string; size: number }>;
  delete(key: string): Promise<void>;
  getSignedDownloadUrl?(key: string, expiresInSeconds: number): Promise<string>;
}
```

Two adapters ship:

- **Local filesystem adapter** (default) — writes to `STORAGE_DIR` (default `./var/storage`),
  sharded by the first two characters of the key.
- **S3-compatible adapter** — implemented against the S3 REST API with SigV4 signing; documented
  in `docs/deployment.md` including the bucket policy and CORS requirements. It is exercised by a
  unit test against a fake S3 server so the adapter logic is covered without network access.

Shared safety rules live in one module and are applied by every adapter:

- **Randomized keys** — `attachments/<uuid4>`; the original filename never becomes a path.
- **Allow-list of MIME types** — images (png/jpeg/gif/webp), PDF, plain text, Markdown, CSV, and
  Office documents. Everything else is rejected with `415`.
- **Size cap** — 10 MB by default (`MAX_UPLOAD_BYTES`).
- **Safe download headers** — `Content-Disposition: attachment; filename="…"` with a sanitized
  name, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'`.
  Files are never rendered inline, so an uploaded HTML/SVG file cannot execute script in the
  app's origin.

## Alternatives considered

- **Upload directly to S3 with a presigned POST** — the preferred production path, but it is
  blocked by the authorization requirement: the API must know the tenant and task before the
  bytes exist. The adapter interface keeps this option open via `getSignedDownloadUrl`.
- **Store bytes in Postgres** — rejected: it couples row size limits to the product and makes
  backups heavy.
- **Virus scanning** — out of scope for v1 (documented).

## Consequences

- The local adapter writes to disk; the directory must be a persistent volume in production.
- Download authorization is enforced by the API before the adapter is called, so a signed URL, if
  ever issued, is short-lived and scoped.
