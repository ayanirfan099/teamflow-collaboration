# Infrastructure

The local stack runs three services: Postgres, the NestJS API and the Next.js web app.

```bash
cp .env.example .env
# set SESSION_SECRET in .env (a random 32 byte hex string is enough)
docker compose -f infra/docker-compose.yml up --build
```

| Service  | URL                   | Notes                                               |
| -------- | --------------------- | --------------------------------------------------- |
| Web app  | http://localhost:3000 | Proxies `/api/v1/*` to the API (same-origin cookie) |
| API      | http://localhost:4000 | REST under `/api/v1`, Socket.IO under `/socket.io`  |
| Postgres | localhost:5432        | `teamflow` database                                 |

The `migrate` service applies `packages/database/prisma/migrations/**` before the API starts.
The migrations are plain SQL files with a checksum, so the step can run on every deploy.

## Without Docker

The repository also runs without Docker: the database package ships the PostgreSQL binaries of
`@embedded-postgres/linux-x64` and can start a throwaway server.

```bash
npm run db:local --workspace @teamflow/database   # prints a DATABASE_URL
npm run db:migrate --workspace @teamflow/database
npm run start --workspace @teamflow/api
npm run dev --workspace @teamflow/web
```

This is the mode the integration tests use (`apps/api/test/global-setup.ts`).

## Production notes

- `SESSION_SECRET` is mandatory in production — the API refuses to start without it.
- `COOKIE_SECURE=true` and `COOKIE_SAME_SITE=none` are required when the app is served over
  HTTPS. Set `COOKIE_DOMAIN` to a shared parent domain when the API runs on a sibling
  subdomain, so the session cookie also reaches the WebSocket handshake.
- `STORAGE_DRIVER=s3` switches the attachment storage to the S3 adapter. The credentials are
  read from `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID` and
  `S3_SECRET_ACCESS_KEY`.
