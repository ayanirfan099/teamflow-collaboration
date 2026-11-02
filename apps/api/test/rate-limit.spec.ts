import request from 'supertest';
import { APP_CONFIG, AppConfig } from '../src/config/configuration';
import { createTestContext, resetDatabase, TestContext } from './helpers/test-context';

/**
 * The rate limiter.
 *
 * The limiter is switched off in the test environment (so the other suites are not slowed
 * down by it), therefore this suite switches it on for the application it boots. The switch
 * only touches the configuration of this instance — no environment variable is changed, so
 * no other suite is affected.
 */
describe('the rate limiter', () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await createTestContext();
    context.app.get<AppConfig>(APP_CONFIG).rateLimit.enabled = true;
  });

  afterAll(async () => {
    await context.close();
  });

  beforeEach(async () => {
    await resetDatabase(context.prisma);
  });

  it('answers with 429 and a retry header when the limit of the sign-in is exceeded', async () => {
    const agent = request.agent(context.app.getHttpServer());
    const csrf = await agent.get('/api/v1/auth/csrf').expect(200);
    const csrfToken = csrf.body.data.token;

    // The limit of the sign-in is ten requests per hour and address.
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await agent
        .post('/api/v1/auth/login')
        .set('x-csrf-token', csrfToken)
        .send({ email: 'limited@example.test', password: 'wrong-password' })
        .expect(401);
    }

    const limited = await agent
      .post('/api/v1/auth/login')
      .set('x-csrf-token', csrfToken)
      .send({ email: 'limited@example.test', password: 'wrong-password' })
      .expect(429);

    expect(limited.body.error.code).toBe('rate_limited');
    expect(limited.headers['retry-after']).toBeDefined();
  });

  it('counts every address on its own', async () => {
    const agent = request.agent(context.app.getHttpServer());
    const csrf = await agent.get('/api/v1/auth/csrf').expect(200);
    const csrfToken = csrf.body.data.token;

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await agent
        .post('/api/v1/auth/login')
        .set('x-csrf-token', csrfToken)
        .send({ email: 'second@example.test', password: 'wrong-password' })
        .expect(401);
    }

    // The bucket of the first address does not affect the second one.
    await agent
      .post('/api/v1/auth/login')
      .set('x-csrf-token', csrfToken)
      .send({ email: 'second@example.test', password: 'wrong-password' })
      .expect(429);
  });
});
