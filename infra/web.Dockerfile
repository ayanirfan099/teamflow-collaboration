# syntax=docker/dockerfile:1
#
# The web image. The Next.js application is built with the API URL that the server side
# rewrite proxy uses.
FROM node:22-bookworm-slim AS build

WORKDIR /app

ARG API_URL=http://api:4000
ENV API_URL=$API_URL
ENV NEXT_TELEMETRY_DISABLED=1

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
COPY packages/ui packages/ui
COPY apps/web apps/web

RUN npm run build --workspace @teamflow/contracts \
  && npm run build --workspace @teamflow/ui \
  && npm run build --workspace @teamflow/web

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm ci --no-audit --no-fund --omit=dev && npm cache clean --force

COPY --from=build /app/apps/web/.next apps/web/.next
COPY --from=build /app/apps/web/next.config.ts apps/web/next.config.ts
COPY --from=build /app/apps/web/package.json apps/web/package.json
COPY --from=build /app/apps/web/public apps/web/public
COPY --from=build /app/packages/ui/dist packages/ui/dist
COPY --from=build /app/packages/ui/package.json packages/ui/package.json
COPY --from=build /app/packages/contracts/dist packages/contracts/dist
COPY --from=build /app/packages/contracts/package.json packages/contracts/package.json

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "run", "start", "--workspace", "@teamflow/web"]
