# TeamFlow — API conventions

All endpoints are prefixed with `/api/v1` and speak JSON. The API is served by `apps/api`.

## 1. Envelope

**Success**

```json
{
  "data": { "id": "…", "name": "…" },
  "meta": { "requestId": "0f9c…", "limit": 25, "nextCursor": "eyJ…", "hasMore": true }
}
```

`meta.requestId` is always present and is also returned as the `x-request-id` response header.

**Error**

```json
{
  "error": {
    "code": "task_not_found",
    "message": "Task was not found.",
    "details": { "field": "title" },
    "requestId": "0f9c…"
  }
}
```

Internal stack traces, SQL, Prisma error text and Node error names are never included in the
response body. Validation details expose only field names and human-readable reasons.

## 2. Error codes

| HTTP | `code`                                           | Meaning                                                                            |
| ---- | ------------------------------------------------ | ---------------------------------------------------------------------------------- |
| 400  | `validation_failed`                              | Body/query failed schema validation.                                               |
| 401  | `unauthenticated`                                | Missing, malformed or expired session.                                             |
| 401  | `invalid_credentials`                            | Sign-in failed (email unknown or password wrong — same message for both).          |
| 403  | `forbidden`                                      | Authenticated but lacking the capability for this action.                          |
| 403  | `csrf_failed`                                    | Missing or mismatched CSRF token.                                                  |
| 404  | `<resource>_not_found`                           | Missing **or** owned by another tenant.                                            |
| 409  | `conflict`                                       | Optimistic-concurrency version mismatch; `details.current` holds the server state. |
| 409  | `duplicate`                                      | Unique constraint violated (e.g. member already exists).                           |
| 413  | `payload_too_large`                              | Upload exceeds the configured limit.                                               |
| 415  | `unsupported_media_type`                         | Upload MIME type is not allowed.                                                   |
| 422  | `invitation_expired` / `invitation_already_used` | Invitation cannot be accepted.                                                     |
| 429  | `rate_limited`                                   | Too many requests; `Retry-After` header is set.                                    |
| 500  | `internal_error`                                 | Unexpected server-side failure.                                                    |
| 503  | `service_unavailable`                            | A required dependency (database) is unavailable.                                   |

## 3. Authentication

- Sign-in returns `Set-Cookie: tf_session=<opaque>; HttpOnly; SameSite=Lax; Path=/` (`Secure` in
  production).
- The opaque value is 32 random bytes, base64url encoded. Only its SHA-256 hash is stored.
- `GET /api/v1/auth/csrf` issues a session-bound CSRF token (`tf_csrf` cookie, readable by
  JavaScript) which must be echoed in the `x-csrf-token` header on every state-changing request.
- `GET /api/v1/auth/me` returns the current user and the memberships available to them.

## 4. Tenant selection

Organization-scoped endpoints live under `/api/v1/organizations/:organizationId/...`. The
organization id in the path is the tenant key; the API resolves the caller's membership for that
organization and derives the effective role. A header `x-organization-id` may be used by the web
client for convenience, but the path always wins.

## 5. Pagination

Cursor pagination is used for collections that can grow without bound (tasks, comments, activity,
audit, notifications):

```
GET /api/v1/organizations/:organizationId/tasks?limit=25&cursor=<opaque>&order=desc
```

The response `meta` contains `limit`, `nextCursor` (null when exhausted) and `hasMore`. Cursors are
opaque, URL-safe base64 strings; clients must not parse them.

`limit` defaults to 25 and is capped at 100. Invalid values produce `400 validation_failed`.

## 6. Filtering and search

List endpoints accept a documented subset of query parameters, e.g.:

| Parameter         | Type    | Notes                                                              |
| ----------------- | ------- | ------------------------------------------------------------------ |
| `q`               | string  | Free-text search over title and description (trigram/token match). |
| `assigneeId`      | uuid    | Exact assignee filter.                                             |
| `labelIds`        | csv     | Comma-separated label ids (AND semantics).                         |
| `priority`        | csv     | `low`, `medium`, `high`, `urgent`.                                 |
| `due`             | string  | `overdue`, `today`, `week`, `none`.                                |
| `status`          | string  | `open`, `done`, `all`.                                             |
| `includeArchived` | boolean | Default `false`.                                                   |

Unknown query parameters are ignored rather than rejected, to keep clients forward compatible.

## 7. Concurrency

Mutating task endpoints accept the version they last saw:

```json
{ "title": "New title", "version": 7 }
```

If the stored version differs, the API responds `409 conflict` with the current representation in
`error.details.current`, so the client can roll back and re-apply.

## 8. Idempotency

`POST` endpoints that can be retried safely (task creation, invitations, comments) accept an
`Idempotency-Key` header (UUID). The first response is stored for 24 hours and replayed verbatim
for repeated requests with the same key, scope and payload hash. Reusing a key with a different
payload returns `409 duplicate`.

## 9. Rate limiting

| Scope                        | Limit (default)                                    |
| ---------------------------- | -------------------------------------------------- |
| `POST /auth/login`           | 10 requests / 5 min / IP, and 5 / 15 min / account |
| `POST /auth/register`        | 5 / hour / IP                                      |
| `POST /invitations` (accept) | 20 / hour / IP                                     |
| `POST /attachments`          | 60 / hour / user                                   |

Responses include `Retry-After`. Limits are configurable per environment.

## 10. Real-time protocol

Socket.IO namespace `/realtime`. The client passes the session cookie during the handshake.

| Direction | Event                        | Payload                                               |
| --------- | ---------------------------- | ----------------------------------------------------- |
| →         | `room:join`                  | `{ room: "project:<id>" }`                            |
| →         | `room:leave`                 | `{ room: "project:<id>" }`                            |
| ←         | `room:joined` / `room:error` | `{ room }` / `{ code, message }`                      |
| ←         | `task.created`               | Task payload                                          |
| ←         | `task.updated`               | Task payload                                          |
| ←         | `task.moved`                 | `{ taskId, columnId, position, version }`             |
| ←         | `comment.created`            | Comment payload                                       |
| ←         | `notification.created`       | Notification payload                                  |
| ←         | `presence.updated`           | `{ userId, room, online }` — ephemeral, not persisted |

## 11. OpenAPI

The API exposes a generated OpenAPI 3.1 document at `/api/v1/docs` and the raw JSON at
`/api/v1/openapi.json`. The document is produced from the same Zod contracts the API validates
against, so it cannot drift from the implementation.
