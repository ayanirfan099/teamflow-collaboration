import { applyMigrations } from '../migrate';

/**
 * Applies the pending migrations of `DATABASE_URL`.
 *
 * The command is used by the Docker Compose stack (before the API starts) and by the
 * `db:migrate` script of the package.
 */
export async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  const result = await applyMigrations(databaseUrl);
  if (result.applied.length === 0) {
    console.log(`Database is up to date (${result.skipped.length} migrations).`);
    return;
  }
  for (const name of result.applied) {
    console.log(`Applied migration ${name}`);
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
