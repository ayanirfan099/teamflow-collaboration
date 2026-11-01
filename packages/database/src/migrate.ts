import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Client } from 'pg';
import { parseDatabaseUrl } from './database-url';

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

interface MigrationFile {
  name: string;
  sql: string;
  checksum: string;
}

const MIGRATIONS_TABLE = '_migrations';

/** Reads the SQL files of `prisma/migrations`, ordered by their folder name. */
export async function readMigrations(directory: string): Promise<MigrationFile[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const folders = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const migrations: MigrationFile[] = [];
  for (const folder of folders) {
    const file = join(directory, folder, 'migration.sql');
    const sql = await readFile(file, 'utf8');
    migrations.push({
      name: folder,
      sql,
      checksum: createHash('sha256').update(sql).digest('hex'),
    });
  }
  return migrations;
}

/**
 * Applies every migration that has not been applied yet.
 *
 * The runner is deliberately simple: it applies the SQL of a migration inside a transaction
 * and stores the checksum, so a changed migration is reported instead of silently ignored.
 */
export async function applyMigrations(
  databaseUrl: string,
  migrationsDirectory = join(__dirname, '..', 'prisma', 'migrations'),
): Promise<MigrationResult> {
  const { url, schema } = parseDatabaseUrl(databaseUrl);
  const client = new Client({ connectionString: url });
  await client.connect();

  const result: MigrationResult = { applied: [], skipped: [] };

  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    await client.query(`SET search_path TO "${schema}", public`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${MIGRATIONS_TABLE}" (
        name TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const migrations = await readMigrations(migrationsDirectory);
    const existing = await client.query<{ name: string; checksum: string }>(
      `SELECT name, checksum FROM "${MIGRATIONS_TABLE}"`,
    );
    const known = new Map(existing.rows.map((row) => [row.name, row.checksum]));

    for (const migration of migrations) {
      const appliedChecksum = known.get(migration.name);
      if (appliedChecksum) {
        if (appliedChecksum !== migration.checksum) {
          throw new Error(
            `Migration ${migration.name} was changed after it was applied. Create a new migration instead.`,
          );
        }
        result.skipped.push(migration.name);
        continue;
      }

      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        await client.query(`INSERT INTO "${MIGRATIONS_TABLE}" (name, checksum) VALUES ($1, $2)`, [
          migration.name,
          migration.checksum,
        ]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
      result.applied.push(migration.name);
    }
  } finally {
    await client.end();
  }

  return result;
}
