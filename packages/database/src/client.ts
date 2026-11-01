import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from './generated/client/client';
import { parseDatabaseUrl } from './database-url';

export { Prisma, PrismaClient };
export * from './generated/client/client';
export type {
  ActivityEvent,
  ActivityType,
  Attachment,
  AuditAction,
  AuditEvent,
  Board,
  Column,
  Comment,
  IdempotencyRecord,
  Invitation,
  Label,
  Membership,
  MemberRole,
  Notification,
  NotificationType,
  Organization,
  Project,
  Session,
  Task,
  TaskAssignee,
  TaskLabel,
  TaskPriority,
  TaskStatus,
  User,
} from './generated/client/client';

export interface CreateClientOptions {
  /** Overrides `DATABASE_URL` (used by the test harness). */
  url?: string;
}

/**
 * Creates a Prisma client that talks to Postgres through the `pg` driver.
 *
 * The client is the Rust-free variant: the query compiler runs as WebAssembly, so no native
 * engine has to be present. The schema is part of the adapter configuration, because the
 * Prisma query compiler qualifies table names itself.
 */
export function createPrismaClient(options: CreateClientOptions = {}): PrismaClient {
  const raw = options.url ?? process.env.DATABASE_URL ?? '';
  if (!raw) {
    throw new Error('DATABASE_URL is not set');
  }
  const { url, schema } = parseDatabaseUrl(raw);

  const adapter = new PrismaPg(
    {
      connectionString: url,
      // Raw SQL (migrations, health checks) has to use the same schema as the generated queries.
      options: `-c search_path="${schema}",public`,
    },
    { schema },
  );

  return new PrismaClient({ adapter });
}

/** A lazily created process-wide client for scripts. */
let sharedClient: PrismaClient | undefined;

export function getPrismaClient(): PrismaClient {
  if (!sharedClient) {
    sharedClient = createPrismaClient();
  }
  return sharedClient;
}
