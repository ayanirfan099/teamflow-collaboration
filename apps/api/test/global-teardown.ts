import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

/** Stops the embedded test database and removes its state file. */
export default async function globalTeardown(): Promise<void> {
  const handle = (globalThis as { __teamflowPostgres?: { stop: () => Promise<void> } })
    .__teamflowPostgres;
  if (handle) {
    await handle.stop().catch(() => undefined);
  }

  const stateFile = join(__dirname, '..', '..', '..', 'var', 'test-postgres.json');
  if (existsSync(stateFile)) {
    rmSync(stateFile, { force: true });
  }
}
