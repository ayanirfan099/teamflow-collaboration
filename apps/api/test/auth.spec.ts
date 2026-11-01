import request from 'supertest';
import {
  createTestContext,
  resetDatabase,
  signIn,
  signUp,
  TestContext,
} from './helpers/test-context';

describe('authentication', () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await createTestContext();
  });

  afterAll(async () => {
    await context.close();
  });

  beforeEach(async () => {
    await resetDatabase(context.prisma);
  });

  it('registers a user and returns the session', async () => {
    const agent = request.agent(context.app.getHttpServer());
    const csrf = await agent.get('/api/v1/auth/csrf').expect(200);

    const registered = await agent
      .post('/api/v1/auth/register')
      .set('x-csrf-token', csrf.body.data.token)
      .send({ email: 'ada@example.test', name: 'Ada Lovelace', password: 'SuperSecret!2026' })
      .expect(201);

    expect(registered.body.data.user.email).toBe('ada@example.test');
    expect(registered.body.data.user.passwordHash).toBeUndefined();

    const cookies = String(registered.headers['set-cookie']);
    expect(cookies).toContain('tf_session=');
    expect(cookies).toContain('HttpOnly');
  });

  it('refuses a second registration for the same address', async () => {
    const { agent, csrfToken } = await signUp(context.app, { email: 'ada@example.test' });

    const duplicate = await agent
      .post('/api/v1/auth/register')
      .set('x-csrf-token', csrfToken)
      .send({ email: 'ada@example.test', name: 'Ada', password: 'SuperSecret!2026' })
      .expect(409);
    expect(duplicate.body.error.code).toBe('duplicate');
  });

  it('rejects an invalid registration payload', async () => {
    const agent = request.agent(context.app.getHttpServer());
    const csrf = await agent.get('/api/v1/auth/csrf').expect(200);

    const response = await agent
      .post('/api/v1/auth/register')
      .set('x-csrf-token', csrf.body.data.token)
      .send({ email: 'not-an-email', name: 'A', password: 'short' })
      .expect(400);

    expect(response.body.error.code).toBe('validation_failed');
    expect(Array.isArray(response.body.error.details.issues)).toBe(true);
  });

  it('answers an unknown address and a wrong password in the same way', async () => {
    await signUp(context.app, { email: 'ada@example.test' });

    const unknownAgent = request.agent(context.app.getHttpServer());
    const unknownCsrf = await unknownAgent.get('/api/v1/auth/csrf').expect(200);
    const unknown = await unknownAgent
      .post('/api/v1/auth/login')
      .set('x-csrf-token', unknownCsrf.body.data.token)
      .send({ email: 'nobody@example.test', password: 'SuperSecret!2026' })
      .expect(401);

    const wrongAgent = request.agent(context.app.getHttpServer());
    const wrongCsrf = await wrongAgent.get('/api/v1/auth/csrf').expect(200);
    const wrong = await wrongAgent
      .post('/api/v1/auth/login')
      .set('x-csrf-token', wrongCsrf.body.data.token)
      .send({ email: 'ada@example.test', password: 'WrongPassword!2026' })
      .expect(401);

    expect(unknown.body.error.code).toBe('invalid_credentials');
    expect(wrong.body.error.code).toBe('invalid_credentials');
    expect(unknown.body.error.message).toBe(wrong.body.error.message);
  });

  it('signs a user out and invalidates the session', async () => {
    const { agent, csrfToken } = await signUp(context.app, { email: 'ada@example.test' });

    await agent.get('/api/v1/auth/me').expect(200);
    await agent.post('/api/v1/auth/logout').set('x-csrf-token', csrfToken).expect(201);

    const afterLogout = await agent.get('/api/v1/auth/me').expect(401);
    expect(afterLogout.body.error.code).toBe('unauthenticated');
  });

  it('rejects a state changing request without a CSRF token', async () => {
    const { agent } = await signUp(context.app, { email: 'ada@example.test' });

    const response = await agent
      .post('/api/v1/organizations')
      .send({ name: 'No CSRF' })
      .expect(403);
    expect(response.body.error.code).toBe('csrf_failed');
  });

  it('rejects a request to a protected route without a session', async () => {
    const response = await request(context.app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    expect(response.body.error.code).toBe('unauthenticated');
  });

  it('revokes every session when signing out everywhere', async () => {
    const { agent, csrfToken } = await signUp(context.app, { email: 'ada@example.test' });
    const second = await signIn(context.app, 'ada@example.test');

    await second.agent.get('/api/v1/auth/me').expect(200);

    const response = await agent
      .post('/api/v1/auth/logout-all')
      .set('x-csrf-token', csrfToken)
      .expect(201);
    expect(response.body.data.revokedSessions).toBe(2);

    await agent.get('/api/v1/auth/me').expect(401);
    await second.agent.get('/api/v1/auth/me').expect(401);
  });

  it('adds a request id to the error envelope and never leaks a stack trace', async () => {
    const response = await request(context.app.getHttpServer())
      .get('/api/v1/organizations/00000000-0000-4000-8000-000000000000')
      .expect(401);

    expect(response.body.error.requestId).toBeDefined();
    expect(response.headers['x-request-id']).toBe(response.body.error.requestId);
    expect(JSON.stringify(response.body)).not.toContain('at ');
  });
});
