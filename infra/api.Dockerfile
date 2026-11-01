# syntax=docker/dockerfile:1
#
# The API image. It contains the database package (schema, generated client and the migration
# runner), the shared contracts and the NestJS application.
FROM node:22-bookworm-slim AS build

WORKDIR /app

# Install the workspace dependencies first so that the layer is cached.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN npm ci --no-audit --no-fund

COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY packages/database packages/database
COPY apps/api apps/api

# The Prisma client is generated from the schema. No native engine is downloaded (ADR 0008),
# the query compiler runs as WebAssembly.
RUN npm run db:generate

RUN npm run build --workspace @teamflow/contracts \
  && npm run build --workspace @teamflow/database \
  && npm run build --workspace @teamflow/api

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN npm ci --no-audit --no-fund --omit=dev && npm cache clean --force

COPY --from=build /app/packages/contracts/dist packages/contracts/dist
COPY --from=build /app/packages/contracts/package.json packages/contracts/package.json
COPY --from=build /app/packages/database/dist packages/database/dist
COPY --from=build /app/packages/database/prisma packages/database/prisma
COPY --from=build /app/packages/database/package.json packages/database/package.json
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/package.json apps/api/package.json

EXPOSE 4000

# The container is healthy as soon as the API answers the liveness probe.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/v1/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/api/dist/main.js"]
