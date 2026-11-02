# Benchmarks

The numbers in this document are **measured**, not estimated. They were produced by
`apps/api/scripts/benchmark.mjs`, which starts a throwaway PostgreSQL server, boots the real
NestJS application (no mocks, no stubs), fills one workspace with a realistic amount of data
and measures the requests a browser sends while a board is used.

The raw result of every run is written to `var/benchmark.json` (the folder is ignored by git).

## How to reproduce

```bash
npm ci
npm run db:generate
npm run build:packages
npm run build --workspace @teamflow/api
npm run benchmark --workspace @teamflow/api
```

The size of the data set and the number of iterations can be changed:

```bash
BENCH_TASKS=2000 BENCH_ITERATIONS=200 npm run benchmark --workspace @teamflow/api
```

| variable           | default | meaning                                                           |
| ------------------ | ------- | ----------------------------------------------------------------- |
| `BENCH_TASKS`      | `500`   | number of tasks in the measured project                           |
| `BENCH_ITERATIONS` | `100`   | measured requests per scenario                                    |
| `BENCH_WARMUP`     | `20`    | requests that are executed and thrown away before the measurement |

## The environment of the measurement

|          |                                                                                     |
| -------- | ----------------------------------------------------------------------------------- |
| Date     | 2026-11-02                                                                          |
| Node.js  | v22.22.3                                                                            |
| CPU      | Intel Xeon Platinum, 2 vCPU, 2.60 GHz                                               |
| Memory   | 3.8 GB                                                                              |
| Database | PostgreSQL 17 (the embedded server of `@embedded-postgres/linux-x64`), local socket |
| API      | NestJS 11, running **in the same process** as the benchmark (supertest)             |

## The result

500 tasks in one project, 100 measured requests per read scenario, 20 per write scenario.

| scenario                                     | requests | p50      | p95          | p99      | max      |
| -------------------------------------------- | -------- | -------- | ------------ | -------- | -------- |
| `GET /tasks?projectId=…` (the board)         | 100      | 10.19 ms | **13.24 ms** | 14.98 ms | 41.78 ms |
| `GET /tasks?q=…` (the search of the board)   | 100      | 9.67 ms  | **12.43 ms** | 15.33 ms | 15.86 ms |
| `GET /tasks/:taskId` (the detail of a card)  | 100      | 7.09 ms  | **9 ms**     | 9.86 ms  | 17.78 ms |
| `GET /dashboard` (My Work)                   | 100      | 10.04 ms | **13.66 ms** | 14.23 ms | 28.86 ms |
| `GET /activity` (the timeline)               | 100      | 6.63 ms  | **8.07 ms**  | 8.92 ms  | 9.09 ms  |
| `GET /members` (the directory)               | 100      | 6.58 ms  | **8.14 ms**  | 9.36 ms  | 16.6 ms  |
| `GET /auth/me` (the session of the shell)    | 100      | 6.1 ms   | **7.45 ms**  | 9.06 ms  | 37.28 ms |
| `POST /tasks/:taskId/move` (a card is moved) | 20       | 13.79 ms | **15.45 ms** | 19.03 ms | 19.03 ms |
| `POST /tasks` (a card is created)            | 20       | 13.43 ms | **17.48 ms** | 17.58 ms | 17.58 ms |

**Every read of the board stays below 15 ms at the 95th percentile.** The measurement includes
the structured access log of every request (`LOG_LEVEL=info`, the production default).

The slowest scenario is the move of a card: it writes the task, an activity event and the
notification of the watchers in one transaction, so it costs more than a read.

## What the measurement says — and what it does not

The measurement is honest, but it is small. Please read it with these limits in mind:

- **One client, no concurrency.** The benchmark sends the requests one after another. It says
  nothing about the behaviour of the API under a load of many parallel users.
- **The API runs in the same process as the client.** The numbers therefore contain the
  complete server work (guards, Zod parsing, Prisma, PostgreSQL), but they do **not** contain
  the network hop, the TLS termination or the proxy.
- **The database is local.** The embedded PostgreSQL server talks over a local socket, so the
  database latency is far lower than it would be against a managed database in another region.
- **The hardware is a shared container** with two vCPUs. A dedicated machine with more cores
  would be faster; a noisy neighbour would be slower.
- **No cache is cold.** The benchmark warms up before it measures, so the numbers describe a
  warm system. The first request after a deploy is slower.
- **The writes are not representative of a real workspace.** Every write also writes an
  activity event and — for a task with assignees — notifications. A workspace with many
  watchers per task therefore has slower writes than the numbers above.

## Why the API is fast enough for the target

- The board reads **one page** of tasks (`limit`, default 25, at most 100) with a cursor, never
  the whole project.
- The order of the cards is stored as a gap (a `BigInt` between two neighbours), so a move
  writes **one row** instead of rewriting the whole column. See
  [ADR 0004](adr/0004-fractional-ordering.md).
- Every query is scoped by `organizationId`, and the indexes of the task table start with the
  organisation, so the tenant filter is part of the index and not an additional filter on top
  of it.
- The search is a case-insensitive `contains` over the title and the description. A pattern
  like `%navigation%` cannot use a b-tree index, so the database scans the tasks of the
  project. That is fast enough for the projects of a real team (see the measurement above),
  but a workspace with hundreds of thousands of tasks would need a trigram index
  (`pg_trgm`). This is listed as a limitation, not as a solved problem.

## What is not measured yet

- The latency of the WebSocket gateway (Socket.IO) and the time until an event arrives in the
  browser.
- The behaviour under a load of many parallel users (no load test is part of the repository).
- The cold start of the API and the first query after a restart.
- The behaviour of the S3 storage adapter — the local adapter is used in the measurement.
