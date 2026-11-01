# TeamFlow — Product Requirements (v1)

## 1. Problem statement

Small product and engineering teams coordinate work across boards, chat threads and spreadsheets.
Most lightweight Kanban tools are single-tenant, have weak permission models and lose context
(who changed what, when). TeamFlow provides a multi-tenant project-management workspace where
every action is attributable, tenant-isolated and visible in real time.

## 2. Personas

| Persona | Needs |
| --- | --- |
| **Owner** | Full control of the organization, billing seat, audit log, destructive actions. |
| **Admin** | Manage members, roles, projects and boards; moderate content. |
| **Member** | Create and edit work, comment, attach files, be assigned. |
| **Viewer** | Read-only access to projects, boards and dashboards. |
| **Guest invitee** | Accepts a one-time invitation to join one organization. |

## 3. Roles and capability matrix

Capabilities are enforced centrally in the API (single policy module). The web client mirrors the
matrix for UI affordances only — the API is authoritative.

| Capability | Owner | Admin | Member | Viewer |
| --- | :-: | :-: | :-: | :-: |
| `organization:read` / `organization:update` | ✅ | ✅ | ✅ (name only) | ✅ (read) |
| `organization:delete` | ✅ | ❌ | ❌ | ❌ |
| `member:invite` | ✅ | ✅ | ❌ | ❌ |
| `member:remove` / `member:update-role` | ✅ | ✅ (not owner) | ❌ | ❌ |
| `member:read` | ✅ | ✅ | ✅ | ✅ |
| `audit:read` | ✅ | ✅ | ❌ | ❌ |
| `project:create` / `project:update` | ✅ | ✅ | ✅ | ❌ |
| `project:archive` / `project:delete` | ✅ | ✅ | ❌ | ❌ |
| `board:manage` | ✅ | ✅ | ✅ | ❌ |
| `task:create` / `task:update` | ✅ | ✅ | ✅ | ❌ |
| `task:delete` | ✅ | ✅ | own tasks | ❌ |
| `comment:create` / `comment:delete` | ✅ | ✅ | own comments | ❌ |
| `attachment:upload` / `attachment:delete` | ✅ | ✅ | ✅ | ❌ |
| `notification:read` (own) | ✅ | ✅ | ✅ | ✅ |
| `invitation:create` / `invitation:revoke` | ✅ | ✅ | ❌ | ❌ |

A user may hold different roles in different organizations. The active organization is chosen per
request (path segment + explicit header) and every authorization decision is evaluated against the
membership for that organization.

## 4. Functional requirements

### 4.1 Authentication and session management
- FR-AUTH-1 Email + password sign-in, sign-up and sign-out.
- FR-AUTH-2 Opaque, server-managed sessions in `HttpOnly` cookies; no long-lived tokens in
  browser storage (no `localStorage`/`sessionStorage` bearer tokens).
- FR-AUTH-3 Passwords hashed with a memory-hard KDF and a per-user random salt.
- FR-AUTH-4 Sessions are revocable individually and in bulk; revocation takes effect on the next
  request and immediately for live sockets.
- FR-AUTH-5 All state-changing requests are CSRF-protected with a session-bound double-submit
  token plus `SameSite` cookies.
- FR-AUTH-6 Rate-limited sign-in and invitation acceptance (per IP and per account).
- FR-AUTH-7 "Sign out everywhere" revokes every active session for the user.

### 4.2 Organizations and membership
- FR-ORG-1 Create an organization (creator becomes `owner`).
- FR-ORG-2 Invite a user by email with a role; invitation links expire (default 7 days) and can be
  accepted exactly once.
- FR-ORG-3 Accept or decline an invitation; accepting creates the membership atomically and marks
  the invitation consumed.
- FR-ORG-4 Update a member's role; refuse changes that would remove the last owner.
- FR-ORG-5 Remove a member; their tasks/comments remain but are attributed to a deactivated
  account placeholder.
- FR-ORG-6 Organization switcher lists only organizations the caller belongs to.
- FR-ORG-7 Member directory with role, joined date and workload summary.

### 4.3 Projects, boards and tasks
- FR-PRJ-1 Create, update and archive projects; archived projects are read-only.
- FR-PRJ-2 One or more boards per project; exactly one board may be the project default.
- FR-PRJ-3 Configurable columns (name, order, optional WIP limit, "done" flag).
- FR-PRJ-4 Create and edit tasks with title, description, priority, due date, labels, assignees.
- FR-PRJ-5 Drag-and-drop between columns, with a keyboard-accessible alternative (move menu) and
  screen-reader announcements.
- FR-PRJ-6 Ordering must not rewrite every task when one task moves (fractional ordering keys).
- FR-PRJ-7 Filter by assignee, label, priority, due date and free-text search across title and
  description.
- FR-PRJ-8 Complete and archive tasks; completed tasks are excluded from the default board view.
- FR-PRJ-9 Every mutation is tenant-scoped: cross-tenant identifiers return `404`, never data.

### 4.4 Collaboration
- FR-COL-1 Comment on a task; edit/delete own comments.
- FR-COL-2 `@mentions` create in-app notifications for mentioned members.
- FR-COL-3 Per-task activity timeline of durable events (create, edit, move, assign, comment,
  attach, complete).
- FR-COL-4 Optimistic UI updates with automatic rollback when the server rejects the change
  (version conflict or authorization failure).
- FR-COL-5 Authenticated real-time channels per organization and per project; unauthorized
  sockets are rejected at handshake and on room join.
- FR-COL-6 Task and comment changes are broadcast to subscribed rooms within ~1s.
- FR-COL-7 Presence is ephemeral and clearly labelled; it is never written to the audit trail.

### 4.5 Attachments
- FR-ATT-1 Upload attachments to a task with server-side size and MIME-type enforcement.
- FR-ATT-2 Randomized storage keys; original filenames are sanitized and never used as paths.
- FR-ATT-3 Download requires a current membership of the owning organization; downloads are
  streamed with `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff`.
- FR-ATT-4 Unsafe types are never served inline.
- FR-ATT-5 Storage is an interface with a local filesystem adapter (dev) and a documented
  S3-compatible adapter (production).

### 4.6 Notifications and audit
- FR-NOT-1 Notification center listing the caller's notifications, newest first.
- FR-NOT-2 Mark one or all notifications as read; unread count badge.
- FR-NOT-3 Notifications are created for task assignment and for mentions.
- FR-AUD-1 Audit events are written for membership, role, project, board and invitation changes.
- FR-AUD-2 Audit log is readable by owners and admins only, and is itself tenant-scoped.

### 4.7 Dashboard and search
- FR-DASH-1 "My work" dashboard: assigned to me, overdue, due soon, completed recently.
- FR-DASH-2 Project progress is computed from persisted tasks (done / total), never hard-coded.
- FR-DASH-3 Global task search within the active organization with filters.
- FR-DASH-4 Honest empty states everywhere: no fake data, no fake metrics.

## 5. Non-functional requirements

| Area | Requirement |
| --- | --- |
| Tenancy | Every organization-owned row carries `organizationId`; enforced in code and covered by isolation tests. |
| Performance | Board read p95 < 300 ms at 500 tasks/board (measured on the seed dataset, see `docs/benchmarks.md`). |
| Security | OWASP ASVS L2-aligned controls for auth, session, CSRF, access control and file upload. |
| Accessibility | WCAG 2.2 AA for all primary flows; keyboard-only operation; visible focus; reduced motion. |
| Reliability | Graceful degradation when Redis is unavailable; DB health surfaced by `/ready`. |
| Observability | Structured JSON logs with a request id echoed in every response header. |
| Privacy | No real personal data in fixtures; demo accounts use fictional names; no PII in logs. |

## 6. Out of scope for v1

See [`docs/out-of-scope.md`](./out-of-scope.md).

## 7. Acceptance criteria for v1

1. A clean checkout boots with `docker compose up` (or the documented local Postgres) and the
   documented seed accounts can sign in.
2. Tenant-isolation, WebSocket-authorization, concurrency and attachment-access tests pass in CI.
3. The end-to-end journey (sign in → create project → create/move task → comment/mention →
   activity visible) is automated with Playwright.
4. The README contains a real screenshot, architecture diagram, quick start, test commands and an
   honest limitations section.
