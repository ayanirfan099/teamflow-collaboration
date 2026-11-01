import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { applyMigrations, startLocalPostgres, LocalPostgresHandle } from '@teamflow/database';

/**
 * Starts a throwaway PostgreSQL server for the integration tests.
 *
 * `TEST_DATABASE_URL` can point at an existing database; otherwise the embedded server is
 * used. The connection string is written to `var/test-postgres.json` so the teardown can stop
 * the server again.
 */
export default async function globalSetup(): Promise<void> {
  const stateDirectory = join(__dirname, '..', '..', '..', 'var');
  mkdirSync(stateDirectory, { recursive: true });
  const stateFile = join(stateDirectory, 'test-postgres.json');

  const existing = process.env.TEST_DATABASE_URL;
  if (existing) {
    writeFileSync(stateFile, JSON.stringify({ url: existing, embedded: false }, null, 2), 'utf8');
    process.env.DATABASE_URL = existing;
    await applyMigrations(existing);
    return;
  }

  const handle: LocalPostgresHandle = await startLocalPostgres({ databaseName: 'teamflow_test' });
  const url = `${handle.url}?schema=teamflow_test`;
  process.env.DATABASE_URL = url;

  // The teardown runs in the same process, so the handle can be handed over directly.
  (globalThis as { __teamflowPostgres?: LocalPostgresHandle }).__teamflowPostgres = handle;

  await applyMigrations(url);

  writeFileSync(
    stateFile,
    JSON.stringify({ url, embedded: true, dataDirectory: handle.dataDirectory }, null, 2),
    'utf8',
  );
}
