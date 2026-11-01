import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from 'pg';

export interface LocalPostgresHandle {
  /** The connection string of the running database. */
  url: string;
  port: number;
  dataDirectory: string;
  stop: () => Promise<void>;
}

/** Finds a free TCP port on the loopback interface. */
export function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

function resolveBinaryDirectory(): string {
  const candidates = [
    join(__dirname, '..', '..', 'node_modules', '@embedded-postgres', 'linux-x64', 'native', 'bin'),
    join(
      __dirname,
      '..',
      '..',
      '..',
      'node_modules',
      '@embedded-postgres',
      'linux-x64',
      'native',
      'bin',
    ),
  ];
  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'initdb'))) {
      return candidate;
    }
  }
  throw new Error(
    'The embedded PostgreSQL binaries were not found. Install @embedded-postgres/linux-x64.',
  );
}

async function waitForReady(url: string, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    const client = new Client({ connectionString: url });
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      return;
    } catch (error) {
      lastError = error;
      await client.end().catch(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  throw new Error(`The local PostgreSQL server did not become ready: ${String(lastError)}`);
}

/**
 * Starts a throwaway PostgreSQL server.
 *
 * The integration tests need a real database. Instead of requiring Docker, the server is
 * started from the PostgreSQL binaries that ship with `@embedded-postgres/linux-x64`.
 */
export async function startLocalPostgres(
  options: {
    databaseName?: string;
    user?: string;
    keepData?: boolean;
  } = {},
): Promise<LocalPostgresHandle> {
  const binaryDirectory = resolveBinaryDirectory();
  const port = await findFreePort();
  const root = mkdtempSync(join(tmpdir(), 'teamflow-pg-'));
  const dataDirectory = join(root, 'data');
  const socketDirectory = join(root, 'socket');

  const user = options.user ?? 'postgres';
  const databaseName = options.databaseName ?? 'teamflow';

  // `initdb` refuses a data directory that already contains a socket directory, so the socket
  // directory is created in its own step.
  await run(join(binaryDirectory, 'initdb'), [
    '-D',
    dataDirectory,
    '-U',
    user,
    '--auth=trust',
    '-E',
    'UTF8',
  ]);
  await run('mkdir', ['-p', socketDirectory]);

  const child: ChildProcess = spawn(
    join(binaryDirectory, 'postgres'),
    ['-D', dataDirectory, '-p', String(port), '-k', socketDirectory, '-h', '127.0.0.1'],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );

  let log = '';
  child.stdout?.on('data', (chunk: Buffer) => {
    log += chunk.toString();
  });
  child.stderr?.on('data', (chunk: Buffer) => {
    log += chunk.toString();
  });

  const url = `postgresql://${user}@127.0.0.1:${port}/${databaseName}`;
  const adminUrl = `postgresql://${user}@127.0.0.1:${port}/postgres`;

  try {
    await waitForReady(adminUrl);
    const client = new Client({ connectionString: adminUrl });
    await client.connect();
    await client.query(`CREATE DATABASE "${databaseName}"`);
    await client.end();
  } catch (error) {
    child.kill('SIGTERM');
    throw new Error(`${String(error)}\n${log}`);
  }

  const stop = async (): Promise<void> => {
    if (child.exitCode === null) {
      await run(join(binaryDirectory, 'pg_ctl'), [
        '-D',
        dataDirectory,
        '-m',
        'immediate',
        'stop',
      ]).catch(() => undefined);
      child.kill('SIGKILL');
    }
    if (!options.keepData) {
      await import('node:fs/promises').then((fs) =>
        fs.rm(root, { recursive: true, force: true }).catch(() => undefined),
      );
    }
  };

  return { url, port, dataDirectory, stop };
}

async function run(command: string, args: string[], cwd?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout?.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(output);
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} failed with code ${code}: ${output}`));
    });
  });
}
