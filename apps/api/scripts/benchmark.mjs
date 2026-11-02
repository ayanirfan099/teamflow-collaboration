/**
 * The benchmark of the API.
 *
 * The script starts a throwaway PostgreSQL server, boots the real application (no mocks),
 * fills one workspace with a realistic amount of data and measures the latency of the
 * requests a browser sends while a board is used.
 *
 * The numbers in `docs/benchmarks.md` are produced by this script — they are never estimated.
 *
 *   npm run build --workspace @teamflow/contracts
 *   npm run build --workspace @teamflow/database
 *   npm run build --workspace @teamflow/api
 *   npm run benchmark --workspace @teamflow/api
 *
 * The size of the data set and the number of iterations can be changed:
 *
 *   BENCH_TASKS=2000 BENCH_ITERATIONS=200 npm run benchmark --workspace @teamflow/api
 *
 * The result is written to `var/benchmark.json` and printed as a table.
 */
import 'reflect-metadata';

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

import cookieParser from 'cookie-parser';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import { applyMigrations, startLocalPostgres } from '@teamflow/database';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUTPUT = resolve(HERE, '..', '..', '..', 'var', 'benchmark.json');

const TASK_COUNT = Number(process.env.BENCH_TASKS ?? 500);
const ITERATIONS = Number(process.env.BENCH_ITERATIONS ?? 100);
const WARMUP = Number(process.env.BENCH_WARMUP ?? 20);
const PASSWORD = 'correct horse battery staple';

/** The percentile of a sorted list of numbers. */
function percentile(sorted, p) {
  if (sorted.length === 0) {
    return 0;
  }
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

function summarise(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((total, value) => total + value, 0);
  return {
    count: sorted.length,
    min: round(sorted[0] ?? 0),
    mean: round(sum / (sorted.length || 1)),
    p50: round(percentile(sorted, 50)),
    p95: round(percentile(sorted, 95)),
    p99: round(percentile(sorted, 99)),
    max: round(sorted[sorted.length - 1] ?? 0),
  };
}

function round(value) {
  return Math.round(value * 100) / 100;
}

/** Runs one request and returns how long it took in milliseconds. */
async function timed(run) {
  const started = performance.now();
  await run();
  return performance.now() - started;
}

/** Runs a scenario a few times and returns the samples. */
async function measure(name, run, iterations = ITERATIONS) {
  for (let index = 0; index < WARMUP; index += 1) {
    await run();
  }
  const samples = [];
  for (let index = 0; index < iterations; index += 1) {
    samples.push(await timed(run));
  }
  const summary = summarise(samples);
  console.log(
    `${name.padEnd(46)} p50 ${String(summary.p50).padStart(8)} ms   ` +
      `p95 ${String(summary.p95).padStart(8)} ms   p99 ${String(summary.p99).padStart(8)} ms`,
  );
  return { name, ...summary };
}

/** Closes the application and stops the database; it is safe to call it twice. */
let shutdown = async () => {};

async function main() {
  console.log(`Starting the throwaway database for ${TASK_COUNT} tasks …`);
  const handle = await startLocalPostgres({ databaseName: 'teamflow_bench' });
  let app = null;
  shutdown = async () => {
    try {
      await app?.close();
    } catch {
      // the application is already closed
    }
    await handle.stop().catch(() => undefined);
  };
  const databaseUrl = `${handle.url}?schema=teamflow_bench`;
  process.env.DATABASE_URL = databaseUrl;
  process.env.NODE_ENV = process.env.NODE_ENV ?? 'development';
  await applyMigrations(databaseUrl);

  // The module is imported after the environment is prepared, so the configuration reads the
  // right database.
  const { AppModule } = await import('../dist/app.module.js');

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.use(cookieParser());
  await app.init();

  const agent = request.agent(app.getHttpServer());
  const csrf = await agent.get('/api/v1/auth/csrf').expect(200);
  const csrfToken = csrf.body.data.token;

  const registered = await agent
    .post('/api/v1/auth/register')
    .set('x-csrf-token', csrfToken)
    .send({
      email: 'benchmark@example.test',
      name: 'Benchmark Owner',
      password: PASSWORD,
      organizationName: 'Benchmark Workspace',
    })
    .expect(201);

  const organizationId = registered.body.data.memberships[0].organizationId;

  // After the registration the CSRF token is bound to the new session.
  const sessionCsrf = await agent.get('/api/v1/auth/csrf').expect(200);
  const csrfTokenAfterLogin = sessionCsrf.body.data.token;

  const project = await agent
    .post(`/api/v1/organizations/${organizationId}/projects`)
    .set('x-csrf-token', csrfTokenAfterLogin)
    .send({ name: 'Benchmark Project', key: 'BENCH', description: 'The data set of the benchmark.' })
    .expect(201);

  const projectId = project.body.data.id;
  const boards = await agent
    .get(`/api/v1/organizations/${organizationId}/projects/${projectId}/boards`)
    .expect(200);
  const boardId = boards.body.data[0].id;
  const columns = await agent
    .get(`/api/v1/organizations/${organizationId}/boards/${boardId}/columns`)
    .expect(200);
  const columnIds = columns.body.data.map((column) => column.id);

  console.log(`Creating ${TASK_COUNT} tasks …`);
  const taskIds = [];
  for (let index = 0; index < TASK_COUNT; index += 1) {
    const columnId = columnIds[index % columnIds.length];
    const created = await agent
      .post(`/api/v1/organizations/${organizationId}/tasks`)
      .set('x-csrf-token', csrfTokenAfterLogin)
      .send({
        title: `Benchmark task ${index}`,
        description: 'A task that exists so the board has a realistic amount of cards.',
        boardId,
        columnId,
        priority: index % 4 === 0 ? 'HIGH' : 'MEDIUM',
      })
      .expect(201);
    taskIds.push(created.body.data.id);
  }

  const results = [];
  console.log('');
  console.log('scenario                                        p50        p95        p99');
  console.log('-------------------------------------------------------------------------------');

  results.push(
    await measure('GET /tasks?projectId=… (the board)', () =>
      agent
        .get(`/api/v1/organizations/${organizationId}/tasks?projectId=${projectId}&limit=50`)
        .expect(200),
    ),
  );

  results.push(
    await measure('GET /tasks?q=… (the search of the board)', () =>
      agent
        .get(
          `/api/v1/organizations/${organizationId}/tasks?projectId=${projectId}&q=task%2042&limit=50`,
        )
        .expect(200),
    ),
  );

  results.push(
    await measure('GET /tasks/:taskId (the detail of a card)', () =>
      agent
        .get(`/api/v1/organizations/${organizationId}/tasks/${taskIds[0]}`)
        .expect(200),
    ),
  );

  results.push(
    await measure('GET /dashboard (My Work)', () =>
      agent.get(`/api/v1/organizations/${organizationId}/dashboard`).expect(200),
    ),
  );

  results.push(
    await measure('GET /activity (the timeline)', () =>
      agent.get(`/api/v1/organizations/${organizationId}/activity?limit=50`).expect(200),
    ),
  );

  results.push(
    await measure('GET /members (the directory)', () =>
      agent.get(`/api/v1/organizations/${organizationId}/members`).expect(200),
    ),
  );

  results.push(
    await measure('GET /auth/me (the session of the shell)', () =>
      agent.get('/api/v1/auth/me').expect(200),
    ),
  );

  // The version of the optimistic concurrency is tracked locally, so the measurement contains
  // the move alone and not an additional read.
  const moveTaskId = taskIds[1];
  const moveTask = await agent
    .get(`/api/v1/organizations/${organizationId}/tasks/${moveTaskId}`)
    .expect(200);
  let moveVersion = moveTask.body.data.version;
  results.push(
    await measure('POST /tasks/:taskId/move (a card is moved)', async () => {
      await agent
        .post(`/api/v1/organizations/${organizationId}/tasks/${moveTaskId}/move`)
        .set('x-csrf-token', csrfTokenAfterLogin)
        .send({ columnId: columnIds[0], afterTaskId: null, version: moveVersion })
        .expect(201);
      moveVersion += 1;
    }, Math.max(20, Math.floor(ITERATIONS / 5))),
  );

  results.push(
    await measure('POST /tasks (a card is created)', async () => {
      await agent
        .post(`/api/v1/organizations/${organizationId}/tasks`)
        .set('x-csrf-token', csrfTokenAfterLogin)
        .send({
          title: `Another benchmark task ${Date.now()}`,
          boardId,
          columnId: columnIds[0],
        })
        .expect(201);
    }, Math.max(20, Math.floor(ITERATIONS / 5))),
  );

  console.log('');
  const report = {
    generatedAt: new Date().toISOString(),
    node: process.version,
    tasks: TASK_COUNT,
    iterations: ITERATIONS,
    warmup: WARMUP,
    results,
  };
  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`The raw result was written to ${OUTPUT}`);

  await shutdown();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await shutdown();
  });
