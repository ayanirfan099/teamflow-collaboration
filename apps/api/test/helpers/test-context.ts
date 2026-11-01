import { INestApplication } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { PrismaClient } from '@teamflow/database';
import { AppModule } from '../../src/app.module';

export interface TestContext {
  app: INestApplication;
  prisma: PrismaClient;
  close: () => Promise<void>;
}

/** Boots the real application (no mocks) against the test database. */
export async function createTestContext(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  app.setGlobalPrefix('api/v1');
  app.use(cookieParser());
  await app.init();

  const prisma = app.get<PrismaClient>(PrismaClient, { strict: false });

  return {
    app,
    prisma,
    close: async () => {
      await app.close();
    },
  };
}

/** Removes every row so each test file starts from a known state. */
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename::text AS "tablename" FROM pg_tables WHERE schemaname = current_schema() AND tablename <> '_migrations'
  `;
  if (tables.length === 0) {
    return;
  }
  const list = tables.map((table) => `"${table.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

export type HttpAgent = ReturnType<typeof request.agent>;

export interface TestAgent {
  agent: HttpAgent;
  csrfToken: string;
  /** Raw session cookie (`name=value`) so other clients can reuse the session. */
  sessionCookie: string;
}

export interface TestUser {
  id: string;
  email: string;
  name: string;
  password: string;
  organizationId?: string;
}

/** Picks the session cookie out of a `set-cookie` response header. */
export function extractSessionCookie(setCookie: string | string[] | undefined): string {
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const session = cookies.find((cookie) => cookie.startsWith('tf_session='));
  if (!session) {
    throw new Error('the response did not set a session cookie');
  }
  return session.split(';')[0]!;
}

/** Creates a signed-up user and returns a supertest agent that keeps the session cookies. */
export async function signUp(
  app: INestApplication,
  user: Partial<TestUser> & { email: string; name?: string; password?: string },
): Promise<TestAgent & { user: TestUser }> {
  const agent = request.agent(app.getHttpServer());
  const csrf = await agent.get('/api/v1/auth/csrf').expect(200);
  const csrfToken = csrf.body.data.token as string;

  const password = user.password ?? 'SuperSecret!2026';
  const name = user.name ?? 'Test User';
  const response = await agent
    .post('/api/v1/auth/register')
    .set('x-csrf-token', csrfToken)
    .send({ email: user.email, name, password })
    .expect(201);

  // After signing in the CSRF token is bound to the session, so it has to be refreshed.
  const sessionCsrf = await agent.get('/api/v1/auth/csrf').expect(200);

  return {
    agent,
    csrfToken: sessionCsrf.body.data.token as string,
    sessionCookie: extractSessionCookie(response.headers['set-cookie']),
    user: { id: response.body.data.user.id, email: user.email, name, password },
  };
}

/** Signs an existing user in and returns an agent with a fresh session. */
export async function signIn(
  app: INestApplication,
  email: string,
  password = 'SuperSecret!2026',
): Promise<TestAgent> {
  const agent = request.agent(app.getHttpServer());
  const csrf = await agent.get('/api/v1/auth/csrf').expect(200);
  const csrfToken = csrf.body.data.token as string;
  const response = await agent
    .post('/api/v1/auth/login')
    .set('x-csrf-token', csrfToken)
    .send({ email, password })
    .expect(201);
  const sessionCsrf = await agent.get('/api/v1/auth/csrf').expect(200);
  return {
    agent,
    csrfToken: sessionCsrf.body.data.token as string,
    sessionCookie: extractSessionCookie(response.headers['set-cookie']),
  };
}

/** Creates an organization through the API and returns its id. */
export async function createOrganization(
  agent: HttpAgent,
  csrfToken: string,
  name = 'Test Organization',
): Promise<string> {
  const response = await agent
    .post('/api/v1/organizations')
    .set('x-csrf-token', csrfToken)
    .send({ name })
    .expect(201);
  return response.body.data.id as string;
}
