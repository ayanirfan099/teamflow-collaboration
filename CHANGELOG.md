# Changelog

All notable changes of TeamFlow are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-11-02

The first release of TeamFlow. It contains the milestones **M0–M5** of the plan in
[`docs/product-requirements.md`](docs/product-requirements.md): the specification and the
architecture, the workspaces and the boards, the collaboration, the attachments and the
administration, and the quality gate.

### Added

**Foundations (M0)**

- The product requirements (44 functional requirements, the role/capability matrix, the
  acceptance criteria), the architecture, the threat model with 17 threats and eight
  architecture decision records.
- A TypeScript monorepo with npm workspaces: `apps/api` (NestJS), `apps/web` (Next.js),
  `packages/contracts` (Zod), `packages/database` (Prisma and SQL migrations),
  `packages/ui` (the design system) and `infra` (the Docker Compose stack).

**Workspaces and access (M1)**

- Registration, sign-in, sign-out, sessions in opaque `HttpOnly` cookies (hashed at rest),
  revocation per session and "sign out everywhere", CSRF protection and a rate-limited sign-in.
- Organizations with the roles `owner`, `admin`, `member` and `viewer`, which map to
  capabilities in a single policy module, and invitations with an expiry and a single use.
- The member directory with the join date and the open tasks of every member.

**Boards and tasks (M2)**

- Projects, boards and columns with a WIP limit, tasks with assignees, labels, priority, due
  date and description.
- Drag-and-drop **and** the keyboard alternative ("Move to…"), so the board is fully operable
  without a pointer.
- A sparse numeric order, so a move writes exactly one row instead of rewriting every task.
- Optimistic concurrency: every task carries a version and a conflict rolls the client back.
- Search over the title and the description, filters for the assignee, the due date, the status,
  the priority and the labels, and a global search page with a deep link into the board.

**Collaboration (M3)**

- Comments with `@mentions` that notify the mentioned people, plus the activity timeline of a
  task and of the workspace.
- Authenticated real-time rooms: a socket without a session is rejected and every room is
  re-authorised against the tenant of the session.

**Attachments, administration and operations (M4)**

- Attachments with a storage abstraction (a local driver and a documented S3 driver), a size and
  type limit, random storage keys and authorized downloads that are never served inline.
- The role administration screen (invite, change the role, remove a member), the audit log with
  a restricted view for owners and admins, and the page with the open sessions.
- Task completion, reopening, archiving and restoring, and the editing and deleting of comments.
- The presence: who is looking at a task right now — ephemeral, never written to the database.
- The rate limiter answers with `429` and a `retry-after` header, and every request writes one
  structured log line with the request id, the method, the path, the status and the duration.

**The quality gate (M5)**

- The Playwright journeys (the sign-up, the board, the complete journey, the phone workflow,
  the accessibility audit and the screenshots), the benchmark script with its measured latency in
  [`docs/benchmarks.md`](docs/benchmarks.md) and the deployment guide in
  [`docs/deployment.md`](docs/deployment.md).

### Fixed

The findings of the end-to-end run and of the accessibility audit of the release candidate:

- The task dialog keeps the live version of the task, so a completed task shows its new status
  immediately and a stale version can no longer be sent.
- The comment box is only cleared when it still holds the comment that was sent, and the dialog
  keeps the last known task while the list is refetched, so a draft is never lost.
- The notification of a mention reaches the mentioned member over the live connection.
- The account menu and the board select are named for the screen readers in a way that keeps their
  visible text, and the toast no longer lowers the contrast of its text.

### Verification

Every statement above was checked by the CI workflow of the release commit
(`39ee4fb`, run `41428178755`): the build, the lint, the format check, the type check, the unit
tests of the web app, the database and the contracts, the 55 integration tests of the API, the
production build of the web app, the end-to-end tests (**8 passed, 1 skipped** — the screenshot
specification runs in its own job) and the screenshots, which are taken from the real
application.

### Known limitations

The scope of v1 is deliberately limited; every gap is listed in
[`docs/out-of-scope.md`](docs/out-of-scope.md). The most important ones: password-only
authentication (no SSO, no MFA, no mail delivery for the invitations), a rate limiter and a
WebSocket registry that live in the process of the API (so they are per instance), a substring
search instead of a trigram index, and attachments that are download-only and not scanned for
malware.

This release makes **no** claim about a hosted environment, an uptime figure or a production
load. The published latency was measured in a container with two vCPUs and is labelled with its
limits.

[1.0.0]: https://github.com/ayanirfan099/teamflow-collaboration/releases/tag/v1.0.0
