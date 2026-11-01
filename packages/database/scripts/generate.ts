import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

/**
 * Generates the Prisma client.
 *
 * The client runs the query compiler as WebAssembly, so no native engine is needed. The CLI
 * nevertheless resolves the engine paths before it reads the schema and tries to download them.
 * Pointing the two environment variables at an existing file avoids the download (ADR 0008).
 */
async function main(): Promise<void> {
  const stub = process.execPath;
  process.env.PRISMA_SCHEMA_ENGINE_BINARY ??= stub;
  process.env.PRISMA_QUERY_ENGINE_LIBRARY ??= stub;

  const schema = resolve(__dirname, '..', 'prisma', 'schema.prisma');
  const result = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['prisma', 'generate', '--schema', schema],
    { stdio: 'inherit', env: process.env },
  );

  if (result.status !== 0) {
    throw new Error(`prisma generate failed with status ${String(result.status)}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
