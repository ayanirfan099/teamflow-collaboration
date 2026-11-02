# Deployment

This guide describes how TeamFlow is built, released and operated. Every command in this
document was executed in the repository — the steps are not hypothetical.

---

## 1. What is deployed

| Component       | Image                  | Port | Notes                                                         |
| --------------- | ---------------------- | ---- | ------------------------------------------------------------- |
| Web application | `infra/web.Dockerfile` | 3000 | Next.js 15, standalone output, proxies `/api/v1/*` to the API |
| API             | `infra/api.Dockerfile` | 4000 | NestJS 11, REST under `/api/v1`, Socket.IO under `/socket.io` |
| Database        | `postgres:17-alpine`   | 5432 | the only stateful service                                     |
| Migration job   | `infra/api.Dockerfile` | –    | runs once per deploy, applies the SQL migrations              |

There is **no Redis**. The rate limiter and the session store live in Postgres, which keeps the
deployment to three moving parts. See [ADR 0001](../docs/adr/0001-monorepo-npm-workspaces.md)
and [ADR 0002](../docs/adr/0002-session-auth.md).

---

## 2. Building the images

```bash
docker build -f infra/api.Dockerfile -t teamflow-api .
docker build -f infra/web.Dockerfile -t teamflow-web .
```

Both images are multi-stage builds: the first stage installs the workspace and compiles the
TypeScript, the second stage contains only the runtime dependencies and the compiled output.
The API image therefore has no compiler and no test tooling in it.

### The image content

- **API image** — `apps/api/dist`, `packages/contracts/dist`, `packages/database/dist`
  (including the generated Prisma client and the SQL migrations) and the production
  dependencies.
- **Web image** — `apps/web/.next`, `packages/ui/dist`, `packages/contracts/dist` and the
  production dependencies.

The Prisma client is generated **without a native engine** (ADR 0008): the query compiler runs
as WebAssembly, so no binary has to match the platform of the image.

---

## 3. The environment

Copy `.env.example` and fill in the values. **Never commit a filled-in `.env`** — the file is
ignored by git, and in production every secret comes from a secret store.

| Variable                                                                            | Required                 | Default                                                                | Description                                                                    |
| ----------------------------------------------------------------------------------- | ------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `DATABASE_URL`                                                                      | yes                      | `postgresql://postgres:postgres@127.0.0.1:5432/teamflow?schema=public` | the connection string; `schema` selects the schema the API works in            |
| `SESSION_SECRET`                                                                    | **yes in production**    | –                                                                      | 32 random bytes, hex encoded. The API refuses to start without it.             |
| `PORT`                                                                              | no                       | `4000`                                                                 | the port of the API                                                            |
| `NODE_ENV`                                                                          | no                       | `development`                                                          | `production` switches the strict cookie defaults                               |
| `LOG_LEVEL`                                                                         | no                       | `info`                                                                 | `debug`, `info`, `warn` or `error`                                             |
| `CORS_ORIGINS`                                                                      | yes                      | `http://localhost:3000`                                                | comma separated list of origins that may send credentialed requests            |
| `COOKIE_SECURE`                                                                     | in production            | `false`                                                                | **has to be `true`** when the app is served over HTTPS                         |
| `COOKIE_SAME_SITE`                                                                  | no                       | `lax`                                                                  | `none` is needed when the API runs on a sibling subdomain                      |
| `COOKIE_DOMAIN`                                                                     | no                       | –                                                                      | shared parent domain, e.g. `.example.com`                                      |
| `SESSION_TTL_DAYS`                                                                  | no                       | `30`                                                                   | the lifetime of a session                                                      |
| `API_URL`                                                                           | yes (web)                | `http://localhost:4000`                                                | the API URL of the **server side** rewrite proxy; it never reaches the browser |
| `NEXT_PUBLIC_API_URL`                                                               | yes (web)                | `http://localhost:4000`                                                | the **public** API URL, used by the browser for the WebSocket handshake        |
| `STORAGE_DRIVER`                                                                    | no                       | `local`                                                                | `local` or `s3`                                                                |
| `STORAGE_DIR`                                                                       | no                       | `var/uploads`                                                          | the target folder of the local adapter                                         |
| `MAX_UPLOAD_BYTES`                                                                  | no                       | `10485760`                                                             | 10 MiB                                                                         |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | with `STORAGE_DRIVER=s3` | –                                                                      | the credentials of the S3 adapter                                              |
| `RATE_LIMIT_ENABLED`                                                                | no                       | `true`                                                                 | the global rate limit                                                          |
| `RATE_LIMIT_WINDOW_SECONDS`                                                         | no                       | `60`                                                                   | the window of the global rate limit                                            |
| `RATE_LIMIT_MAX_REQUESTS`                                                           | no                       | `120`                                                                  | the requests per window and client                                             |

Generate a session secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 4. Running the stack locally with Docker

```bash
cp .env.example .env
# set SESSION_SECRET in .env
docker compose -f infra/docker-compose.yml up --build
```

| Service  | URL                   | Notes                                                                 |
| -------- | --------------------- | --------------------------------------------------------------------- |
| Web app  | http://localhost:3000 | proxies `/api/v1/*` to the API (the session cookie stays same-origin) |
| API      | http://localhost:4000 | REST under `/api/v1`, Socket.IO under `/socket.io`                    |
| Postgres | localhost:5432        | the `teamflow` database                                               |

The `migrate` service applies `packages/database/prisma/migrations/**` before the API starts.
The migrations are plain SQL files with a checksum, so the step is idempotent and can run on
every deploy.

### Without Docker

The database package ships the PostgreSQL binaries of `@embedded-postgres/linux-x64` and can
start a throwaway server — this is the mode the integration tests use.

```bash
npm run db:local --workspace @teamflow/database   # prints a DATABASE_URL
npm run db:migrate --workspace @teamflow/database
npm run start --workspace @teamflow/api
npm run dev --workspace @teamflow/web
```

---

## 5. The release of a new version

```bash
# 1. build everything exactly as CI does
npm ci --no-audit --no-fund
npm run db:generate
npm run build:packages
npm run build --workspace @teamflow/api
npm run build --workspace @teamflow/web

# 2. run the checks
npm run lint
npm run test --workspace @teamflow/api

# 3. build the images
docker build -f infra/api.Dockerfile -t teamflow-api:${VERSION} .
docker build -f infra/web.Dockerfile -t teamflow-web:${VERSION} .

# 4. apply the migrations (idempotent, before the new API starts)
docker run --rm --env-file .env teamflow-api:${VERSION} \
  node packages/database/dist/cli/migrate.js

# 5. roll the API, then the web application
docker compose -f infra/docker-compose.yml up -d api
docker compose -f infra/docker-compose.yml up -d web
```

**Order matters:** the migrations run first, the API is rolled second, the web application
last. The migrations are additive (a new column, a new enum value), so the old API keeps
working while the new one starts.

---

## 6. Health, logs and monitoring

| Endpoint                   | Meaning                                                        |
| -------------------------- | -------------------------------------------------------------- |
| `GET /api/v1/health/live`  | liveness — the process answers                                 |
| `GET /api/v1/health/ready` | readiness — the database answers (`degraded` when it does not) |

Both endpoints are public and never contain details about the database.

Every request gets a request id (`x-request-id`), and the API writes one structured log line
per request as JSON to stdout:

```json
{
  "level": "info",
  "time": "2026-11-02T08:49:06.146Z",
  "message": "request completed",
  "context": {
    "requestId": "904ddfb4-54cf-459f-b61c-44df6d0a3be8",
    "method": "GET",
    "path": "/api/v1/organizations/tasks",
    "status": 200,
    "durationMs": 8
  }
}
```

The line contains the request id, the method, the path, the status and the duration — never a
query string, a body, a cookie or a header.

The logs contain no session cookies, no passwords and no file contents. Collect them with the
log agent of your platform (the Docker images write to stdout, so every collector works).

Recommended alerts:

- the readiness probe fails for more than one minute,
- the p95 of the request duration is above the values in [benchmarks.md](benchmarks.md) for
  five minutes,
- the error rate of the API is above 1 %.

---

## 7. The proxy and the cookies

The browser never talks to the API directly: the Next.js application rewrites `/api/v1/*` to
`API_URL`, so the session cookie is a first-party cookie and the CSRF token never has to
travel to a third party.

The **WebSocket** handshake is the exception: `socket.io-client` connects to
`NEXT_PUBLIC_API_URL`. When the API runs on a sibling subdomain, three values have to be
aligned:

```bash
COOKIE_SECURE=true
COOKIE_SAME_SITE=none
COOKIE_DOMAIN=.example.com
```

The socket is authorised with the session cookie during the handshake, and every room the
client joins is re-authorised against the tenant of the session. An unauthorised socket never
receives an event.

---

## 8. The attachments

The default is the local adapter: the files are written into `STORAGE_DIR` and served through
the API, which checks the permission before every download. The download is sent with
`Content-Disposition: attachment` and `X-Content-Type-Options: nosniff`, and only the file
types of the allowlist are accepted.

For a production installation with more than one API instance, switch to the S3 adapter:

```bash
STORAGE_DRIVER=s3
S3_REGION=eu-central-1
S3_BUCKET=teamflow-attachments
S3_ACCESS_KEY_ID=…
S3_SECRET_ACCESS_KEY=…
```

The storage key is random (`crypto.randomUUID`), never the file name of the user, so a file
cannot be guessed and the name of the file cannot be used to inject a path.

---

## 9. The backup of the database

The only state that cannot be rebuilt is the database. A backup is a `pg_dump` of the schema
the API uses:

```bash
pg_dump --format=custom --file teamflow-$(date +%F).dump "$DATABASE_URL"
```

Restore it into an empty database and apply the migrations afterwards:

```bash
pg_restore --dbname "$DATABASE_URL" --clean --if-exists teamflow-2026-11-02.dump
npm run db:migrate --workspace @teamflow/database
```

When the S3 adapter is used, the attachments live in the bucket and are **not** part of the
dump — the bucket needs its own versioning or replication.

---

## 10. Scaling

- **The API is stateless.** The session lives in the database, so any number of instances can
  serve the requests. A new instance only needs `DATABASE_URL` and `SESSION_SECRET`.
- **The WebSocket gateway is stateless as well.** The rooms are held in the memory of the
  instance; a client that is connected to instance A does not receive the events of instance
  B. With more than one instance a Socket.IO adapter (Redis) is needed — this is not part of
  v1.0.0 and is listed in [out-of-scope.md](out-of-scope.md).
- **The database is the bottleneck** long before the API is. The queries are indexed by
  `organizationId`, so a bigger instance and a connection pool are the first steps.

---

## 11. The checklist before a release

- [ ] `npm run lint` is green
- [ ] `npm run test --workspace @teamflow/api` is green
- [ ] `npm run build --workspace @teamflow/web` is green
- [ ] the end-to-end job of the CI is green
- [ ] `SESSION_SECRET` is set in the secret store (and is **not** the development value)
- [ ] `COOKIE_SECURE=true` and `CORS_ORIGINS` contain the public URL
- [ ] the migrations were applied and the API starts
- [ ] `GET /api/v1/health/ready` answers with `ok`
- [ ] a backup of the database was taken before the migration
