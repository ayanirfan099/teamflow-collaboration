# TeamFlow verification record

This record keeps release chronology, reproducibility evidence and security-control review outside the recruiter-facing README. It records observed checks; it does not imply a public deployment, security certification or production-readiness approval.

## Release boundary

- The annotated `v1.0.0` tag is immutable.
- Annotated tag object: `78dd3bcd297765181698de2269f9626bc7b44269`.
- Peeled source commit: `3ef6e2b883731cf471d1937fcbf5f2e1fae6e715`.
- Current local `main` before this branch: `ae843611c4866e4241647d11e110d445c611c357`.
- The post-tag main change was a screenshot-bot update to `docs/screenshots/task-dialog.png`; the release source was not moved.
- Any merged source change after `v1.0.0` requires a separately reviewed patch-release decision. Never move or recreate `v1.0.0`.

## Latest verified main baseline

GitHub Actions run [41434375203](https://github.com/ayanirfan099/teamflow-collaboration/actions/runs/41434375203) completed successfully at the released source commit.

The later screenshot-only bot commit did not create equivalent normal CI evidence. This hardening branch removes workflow write access so routine Actions runs cannot create or push commits.

## Current-state local verification — 2026-11-03

Environment and isolation:

- Node.js 22
- npm workspaces with the committed lockfile
- native PostgreSQL 18.6 local verification environment
- Playwright Chromium
- isolated role/database `teamflow_verify` / `teamflow_verify_v101`
- runtime secrets entered or generated privately; no value or filled environment file was logged

Observed baseline and candidate results:

- locked `npm ci`: passed
- both checked-in migrations passed from an empty schema
- clean-checkout seed defect reproduced before the fix
- repaired root `npm run db:seed` builds `@teamflow/database`
- repeated seed left all table fingerprints unchanged
- baseline formatting, lint and strict TypeScript checks passed
- contracts tests: 8/8 passed
- database tests: 10/10 passed
- API integration tests: 55/55 passed
- web tests: 14/14 passed in UTC and Asia/Karachi
- API and web production builds passed
- local web/API development startup and database connectivity passed
- deterministic screenshot journey passed twice against independently reset databases
- all three screenshots are 1280×720

Validated screenshot hashes:

    077229073c7eccbf6d098d3ddf02e9e8aa433d51e2a70cec1ab297cd24c6e70b  board.png
    00910809e2956fb5772602fa0c7b3c6d2b26a7f483bb10ef64f42963a35ce5ce  my-work.png
    c89c6e9dccfcb4c4c9d3185792b6666fc3ba8ceef876de304657e92d23298e1c  task-dialog.png

The final source, build and security gate was repeated after the dependency, documentation and workflow changes:

- changed and untracked PR files passed Prettier;
- repository lint passed;
- strict TypeScript checks passed across all workspaces;
- contracts tests passed 8/8;
- database tests passed 10/10;
- API integration tests passed 55/55;
- web tests passed 14/14;
- all five workspace production builds passed;
- checksum-verified Gitleaks 8.30.1 found no leaks in the controlled current worktree or all 23 commits.

The pull-request browser and deterministic-screenshot jobs remain required CI evidence before merge.

## Dependency and secret-scan review

The reviewed dependency update moved the shared contracts, API and web application to Zod 4.6.7 and `@asteasolutions/zod-to-openapi` 9.1.0. Zod 4's explicit record signature and per-instance OpenAPI extension behavior required narrow source migrations; the full API suite passed afterward.

Final npm audit results on 2026-11-03:

- production audit: 3 high, 0 critical, 3 total;
- full dependency audit: 4 low, 33 moderate, 4 high, 2 critical, 43 total;
- production findings: `@prisma/config`, `deepmerge-ts` and `prisma`;
- additional full-tree high/critical findings: `vite`, `tinypool` and `vitest`.

Prisma 6.19.3 is the latest available 6.x release and pins vulnerable `deepmerge-ts` 7.1.5 through its CLI/configuration chain. The generated Prisma client remains the application runtime dependency, but npm retains the optional Prisma CLI peer in the production dependency graph. A Prisma 7 migration and test-tool major upgrades are deliberately deferred as breaking changes. No `npm audit fix --force` result was accepted.

Gitleaks 8.30.1 was downloaded from its GitHub release, verified against the published SHA-256 checksum and run with redaction:

- a controlled snapshot populated from tracked and untracked, non-ignored worktree files: no leaks;
- complete Git history, 23 commits: no leaks.

Ignored local files, filled environment files and runtime secrets were not copied into the controlled snapshot or printed.

## Authorization coverage reviewed

The existing API integration suites explicitly exercise the required boundaries:

- `apps/api/test/tasks.spec.ts`
  - tenant-scoped task access
  - cross-tenant identifiers denied without disclosure
  - authorization and optimistic-concurrency behavior
- `apps/api/test/attachments.spec.ts`
  - tenant-scoped attachment metadata
  - cross-tenant non-disclosure
  - authorized download behavior
  - download headers and unsafe content rejection
- `apps/api/test/realtime.spec.ts`
  - session-authenticated Socket.IO connections
  - organization-room membership
  - malformed, unauthenticated and unauthorized room rejection
  - rejected-room audit behavior

These are application tests, not an independent penetration test.

## Screenshot provenance

The committed images are produced by `apps/web/e2e/screenshots.spec.ts` against the real web, API and PostgreSQL stack.

The capture:

1. resets, migrates and seeds a database containing fictional data;
2. fixes browser time and seeded task timestamps;
3. signs in to the seeded workspace rather than creating random accounts;
4. waits for task, member, label, attachment, comment and real-time state;
5. neutralizes hover, caret and animation effects;
6. captures the project board, task dialog and My Work page.

Chromium can vary a few antialiased pixels by one RGB channel level between otherwise identical renders. The capture retains the committed PNG only when every changed channel is within that one-level tolerance. Any dimension change or pixel difference above that threshold replaces the image, after which CI's repository diff check fails.

The CI screenshot job:

- has only `contents: read`;
- never commits, rebases or pushes;
- verifies whether meaningful screenshot changes altered tracked files;
- uploads the screenshot set as a short-lived artifact.

## Deployment and demo non-claims

- No public deployment URL, uptime, production load test, independent security audit or accessibility certification is claimed.
- The built-in rate limiter is process-local.
- WebSocket rooms and presence are process-local.
- Multi-instance real-time delivery requires an external adapter that is not implemented here.
- Local attachment storage requires a persistent volume and is unsuitable for multiple API replicas.
- Public registration, invitation creation and attachment mutation need edge controls before a shared demo.
- There is no email-delivery integration; invitation acceptance information is returned inside the application.
- The seed must never run against a real-user or production database.

## Reproduce the verification

With a private local database URL and runtime secrets configured:

    npm ci --no-audit --no-fund
    npm run db:generate
    npm run db:migrate
    npm run db:seed
    npm run db:seed
    npm run format:check
    npm run lint
    npm run typecheck
    npm test
    npm run build

For browser journeys, start the migrated API and production web application, then run:

    npm run test:e2e

The screenshot journey is opt-in through `E2E_SCREENSHOTS=1`.

Dependency and history checks used before the pull request:

    npm audit --omit=dev --audit-level=high
    npm audit --audit-level=high
    gitleaks dir <controlled-current-worktree> --redact
    gitleaks git . --redact

The controlled current-worktree directory is populated from `git ls-files --cached --others --exclude-standard`, so ignored local environment and generated dependency files are excluded.

## Repository security controls

Observed through the GitHub API on 2026-11-03:

- the repository is public, active and has `main` as its default branch;
- GitHub detects no repository license;
- secret scanning and push protection are enabled;
- Dependabot security updates are disabled;
- dependency-alert and code-scanning APIs were not enabled or accessible;
- the secret-scanning alerts API is enabled and accessible;
- main branch protection was not enabled or not accessible;
- Actions are enabled and allow all actions;
- the API did not return a repository-level default token permission, while this workflow explicitly sets `contents: read`.

This hardening branch:

- sets GitHub Actions permissions to `contents: read`;
- removes the screenshot bot's write permission, commit, rebase and push loop;
- adds weekly Dependabot updates for npm, GitHub Actions and Dockerfiles;
- keeps dependency and secret-scan results as required pre-PR evidence;
- does not change repository settings or branch rules automatically.

Recommended main-branch rule:

- require pull requests;
- require conversation resolution;
- require build, end-to-end and deterministic-screenshot jobs;
- add any adopted dependency or secret scan as a required check;
- block force pushes and branch deletion;
- do not allow routine status-check bypass.

Repository rules should be enabled only after confirming the account plan and GitHub UI expose the intended settings.

## License status

No license file exists, and no open-source license is granted. Package metadata uses `UNLICENSED` so it no longer implies MIT terms that the repository does not contain.
