import { Client } from 'pg';
import { parseDatabaseUrl } from '../database-url';

/**
 * Drops and recreates the schema of `DATABASE_URL`. Only for local development.
 */
export async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }
  const { url, schema } = parseDatabaseUrl(databaseUrl);
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await client.query(`CREATE SCHEMA "${schema}"`);

    console.log(`Schema "${schema}" has been reset.`);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
