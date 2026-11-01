# TeamFlow — Explicitly out of scope for v1

Listing these keeps the milestone plan honest. Nothing below is partially implemented or hidden
behind a flag; each item is simply not built yet.

## Product

- Billing, subscriptions, invoices and payment processing.
- Guest access without an account (share links, public boards).
- Multiple workspaces per account beyond organization membership.
- Custom fields, task dependencies, subtasks, recurring tasks and task relations.
- Gantt / timeline / calendar views (the board and list views are the only boards in v1).
- Full-text search across comments and attachments (v1 searches task titles/descriptions).
- Bulk editing of tasks.
- Custom notification channels (email, Slack, webhooks) — v1 is in-app only.
- File previews or inline media rendering — attachments are download-only in v1.
- Import/export (CSV, Trello, Jira) and data portability.
- Localization / i18n — the interface is English-only in v1.

## Technical

- Real-time collaborative editing (multi-cursor, CRDT/OT) — v1 broadcasts committed changes.
- Horizontal scaling of the WebSocket tier (no Redis adapter for the Socket.IO server in v1;
  sticky sessions are required when running more than one API replica).
- Multi-tenant sharding or row-level security at the database level — tenant scoping is enforced
  in the application layer and covered by tests.
- Object storage lifecycle policies and virus scanning of uploads.
- Read replicas, connection pooling with PgBouncer, and database failover.
- OpenTelemetry/Jaeger tracing (structured logs with request ids only in v1).
- Feature flags, A/B testing and experimentation tooling.

## Operational

- A hosted, multi-tenant production deployment. The repository ships a non-production reference
  deployment and honest limitations; no hosted environment, uptime or performance claim is made.
- Automated database backups and a tested restore procedure.
- Email delivery for invitations — invitation links are displayed in the UI and printed by the
  seed script.
- SSO / SAML / OIDC — password authentication only in v1.
- MFA / TOTP.

## Planned for v1, but not built yet

The following parts of the v1 scope are implemented on the server but have no (or only a partial)
user interface yet. They are part of the M4 and M5 milestones and are therefore **not** claimed as
finished in the milestone report.

- **Attachments** — the storage abstraction, the local driver and the documented S3 adapter are
  specified; the upload, the download and the attachment UI are still to be built (M4).
- **Role administration** — inviting a member, changing a role and removing a member work on the
  API; the management screens are still to be built (M4).
- **Audit log** — the audit events are recorded and the endpoint is restricted to admins; the
  read-only view is still to be built (M4).
- **Operational dashboards** — structured logs with request ids exist; the aggregation and the
  slow-request metrics are still to be built (M4).
