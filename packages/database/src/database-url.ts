/** Helpers around the `DATABASE_URL` of the API. */

export interface ParsedDatabaseUrl {
  /** The URL without the `schema` parameter. */
  url: string;
  /** The schema the connection has to use. */
  schema: string;
  /** The raw URL including the `schema` parameter. */
  raw: string;
}

export const DEFAULT_SCHEMA = 'public';

/**
 * Splits `postgres://user:pass@host:5432/db?schema=teamflow` into the connection URL and the
 * schema. The Prisma driver adapter needs both: the URL for the connection and the schema for
 * the query compiler.
 */
export function parseDatabaseUrl(raw: string): ParsedDatabaseUrl {
  const url = new URL(raw);
  const schema = url.searchParams.get('schema') ?? DEFAULT_SCHEMA;
  url.searchParams.delete('schema');
  return { url: url.toString(), schema, raw };
}
