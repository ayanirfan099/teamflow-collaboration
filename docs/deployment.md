# Deployment and public-demo guidance

## Status

TeamFlow has no verified public deployment. This document describes a deployment runbook and the controls required before a shared demo; it is not evidence that those controls are operating at a public URL.

## Supported topology

| Component           | Responsibility                                                | State and scaling boundary                                 |
| ------------------- | ------------------------------------------------------------- | ---------------------------------------------------------- |
| Next.js web         | UI, server rendering and same-origin REST proxy               | Stateless; may run separately from the API                 |
| NestJS API          | REST, sessions, authorization, Socket.IO and storage access   | One instance is the supported v1 topology                  |
| PostgreSQL          | Application data, sessions, audit history and migration state | Required persistent service with backups                   |
| Attachment storage  | Local persistent volume or S3-compatible storage              | Local storage is single-instance only                      |
| Redis or equivalent | Socket.IO fan-out and coordinated distributed controls        | Optional future dependency; no adapter is implemented here |

The repository includes `infra/api.Dockerfile`, `infra/web.Dockerfile` and `infra/docker-compose.yml`. Compose is suitable for local verification; a production platform still needs managed secrets, HTTPS, backups, monitoring and reviewed network boundaries.

## Build and release sequence

    npm ci --no-audit --no-fund
    npm run db:generate
    npm run format:check
    npm run lint
    npm run typecheck
    npm test
    npm run build

    docker build -f infra/api.Dockerfile -t teamflow-api:${VERSION} .
    docker build -f infra/web.Dockerfile -t teamflow-web:${VERSION} .

Deploy in this order:

1. back up PostgreSQL and verify restore procedures;
2. apply the checked-in SQL migrations once;
3. wait for migration success;
4. deploy the API and verify liveness/readiness;
5. deploy the web application;
6. run authentication, authorization and WebSocket smoke tests;
7. verify logs, metrics, attachment access and rollback controls.

Do not run the demo seed during a normal production deployment.

## Runtime configuration

Supply configuration through the platform's secret/configuration service. Never commit a filled `.env`, print it in CI, or place secrets in image layers.

Required categories:

- private PostgreSQL connection URL;
- unique high-entropy session secret;
- canonical web/API origins and CORS allowlist;
- secure cookie mode and an appropriate same-site/domain policy;
- API and public WebSocket URLs;
- attachment driver, size limit and storage configuration;
- enabled, bounded rate-limit settings;
- production log level.

Secure cookies are required behind HTTPS. If web and API use sibling subdomains, cookie domain and same-site settings must be reviewed together with the WebSocket handshake. Prefer a same-origin reverse proxy where practical.

## Health and observability

| Endpoint                   | Purpose                   |
| -------------------------- | ------------------------- |
| `GET /api/v1/health/live`  | Process liveness          |
| `GET /api/v1/health/ready` | Database-backed readiness |

The API emits structured request logs with request ID, method, path, status and duration. Production collection must exclude cookies, authorization material, request bodies and uploaded file contents.

Recommended alerts include sustained readiness failure, elevated server-error rate, abnormal authentication failures, exhausted database connections and storage failures.

## PostgreSQL and migrations

- Keep PostgreSQL private to the API and migration job.
- Run migrations as a dedicated one-shot deployment step.
- Use least-privilege runtime and migration roles where supported.
- Back up before migration and test restoration periodically.
- Retain migration history and never edit an applied migration.
- Use a connection pool appropriate to the number of API instances.

A database dump does not include objects stored in S3-compatible storage or a local attachment volume; back those up separately.

## Attachment storage

### Local driver

Use only for one API instance with a persistent, backed-up volume. Ephemeral container filesystems will lose uploads during replacement.

### S3-compatible driver

Use for durable or multi-instance deployments. Keep the bucket private, rotate access credentials, enable encryption and lifecycle policies, and preserve API authorization in front of every download. Do not expose objects through public bucket URLs.

TeamFlow validates an upload allowlist, size limit and known file signatures, but does not include malware scanning. A public upload service needs quarantine, scanning and abuse controls.

## Multiple API instances and optional Redis

Sessions are stored in PostgreSQL, but Socket.IO room state, presence and the built-in rate limiter are process-local.

Before adding API replicas:

- implement and test a supported Socket.IO adapter such as Redis;
- use an external/global rate limiter or trusted edge limit;
- configure sticky behavior only if required by the selected transport;
- verify events and authorization across instances;
- use shared S3-compatible attachment storage.

Do not claim horizontal real-time support until those adapters and cross-instance tests exist.

## Safe shared-demo controls

The repository does not contain a one-switch public-demo mode. A shared demo must therefore be isolated and constrained at the gateway and platform boundaries.

Minimum controls:

1. use a disposable database and storage namespace containing only fictional data;
2. do not publish shipped privileged local fixture credentials;
3. provision a separate fictional viewer or enforce read-only access;
4. deny public registration and invitation creation/acceptance routes;
5. deny attachment upload/removal unless a bounded, scanned path is provided;
6. allow only methods and routes required for the intended tour;
7. keep one API instance unless distributed adapters are implemented;
8. enforce both edge and application rate limits;
9. reset database, sessions and storage on a documented schedule and after abuse;
10. collect no real names, email addresses, customer data or files;
11. verify denied routes with automated HTTP checks before publishing a URL.

There is no email-delivery integration. Invitations are application-local and expose acceptance information to an authorized inviter, which is another reason to block invitation routes in a public demo.

A public URL must not be added to the README until it has been manually verified over HTTPS with these controls.

## Local Compose verification

    cp .env.example .env
    # Replace placeholders privately.
    docker compose -f infra/docker-compose.yml up --build

Local defaults expose the web application on port 3000, the API on port 4000 and PostgreSQL on the configured local database port. They are development defaults, not production secret or network policy.

## Release checklist

- [ ] locked installation, formatting, lint, type checks, tests and production builds pass
- [ ] dependency and full-history secret scans pass
- [ ] migrations succeed from an empty database and on the current backup
- [ ] rollback and database restore procedures are tested
- [ ] runtime and migration credentials follow least privilege
- [ ] HTTPS, canonical origins, CORS and secure cookies are verified
- [ ] registration, invitations and uploads follow the intended exposure policy
- [ ] edge and application rate limits are enabled and tested
- [ ] database and attachment backups are operating
- [ ] health checks, logs, metrics and alerts are operating
- [ ] no seed or fixture credentials are used in a shared environment
- [ ] any claimed public URL has been manually verified
