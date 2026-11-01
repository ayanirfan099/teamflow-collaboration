import { startLocalPostgres } from './local-postgres';

/** Starts a local PostgreSQL server and prints the connection string. */
async function main(): Promise<void> {
  const handle = await startLocalPostgres({ keepData: true });
  // eslint-disable-next-line no-console
  console.log(`DATABASE_URL=${handle.url}?schema=public`);
  // eslint-disable-next-line no-console
  console.log(`Data directory: ${handle.dataDirectory}`);
  // eslint-disable-next-line no-console
  console.log('Press Ctrl+C to stop the server.');
  process.on('SIGINT', () => {
    void handle.stop().then(() => process.exit(0));
  });
  await new Promise(() => undefined);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
