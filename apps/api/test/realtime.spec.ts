import { AuditAction } from '@teamflow/database';
import { io, type Socket } from 'socket.io-client';
import {
  createOrganization,
  createTestContext,
  resetDatabase,
  signUp,
  TestContext,
} from './helpers/test-context';

const SOCKET_PATH = '/socket.io';

function connect(port: number, cookie?: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(`http://127.0.0.1:${port}`, {
      path: SOCKET_PATH,
      transports: ['websocket'],
      extraHeaders: cookie ? { cookie } : {},
      reconnection: false,
      timeout: 5000,
    });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', (error) => reject(error));
    setTimeout(() => reject(new Error('socket did not connect in time')), 6000);
  });
}

function waitFor(socket: Socket, event: string, timeout = 5000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`event ${event} was not received`)), timeout);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

async function waitForAuditEvent(context: TestContext, action: AuditAction) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const events = await context.prisma.auditEvent.findMany({ where: { action } });
    if (events.length > 0) {
      return events;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return [];
}

describe('real-time gateway', () => {
  let context: TestContext;
  let port: number;

  beforeAll(async () => {
    context = await createTestContext();
    await context.app.listen(0);
    const address = context.app.getHttpServer().address();
    port = typeof address === 'object' && address ? address.port : 0;
  });

  afterAll(async () => {
    await context.close();
  });

  beforeEach(async () => {
    await resetDatabase(context.prisma);
  });

  it('rejects a connection without a session cookie', async () => {
    const socket = await connect(port);
    const unauthorized = (await waitFor(socket, 'unauthorized')) as { code: string };
    expect(unauthorized.code).toBe('unauthenticated');
    socket.close();
  });

  it('accepts a session cookie and joins the organization room automatically', async () => {
    const { agent, csrfToken, sessionCookie } = await signUp(context.app, {
      email: 'socket@example.test',
    });
    const organizationId = await createOrganization(agent, csrfToken, 'Socket Org');

    const socket = await connect(port, sessionCookie);
    const ready = (await waitFor(socket, 'ready')) as { user: { email: string } };
    expect(ready.user.email).toBe('socket@example.test');

    const project = await agent
      .post(`/api/v1/organizations/${organizationId}/projects`)
      .set('x-csrf-token', csrfToken)
      .send({ name: 'Realtime project', key: 'RT' })
      .expect(201);

    const eventPromise = waitFor(socket, 'project.updated');
    await agent
      .patch(`/api/v1/organizations/${organizationId}/projects/${project.body.data.id}`)
      .set('x-csrf-token', csrfToken)
      .send({ name: 'Realtime project renamed' })
      .expect(200);

    const event = (await eventPromise) as { project: { name: string } };
    expect(event.project.name).toBe('Realtime project renamed');
    socket.close();
  });

  it('refuses to join a room of another organization', async () => {
    const owner = await signUp(context.app, { email: 'owner@example.test' });
    const organizationId = await createOrganization(owner.agent, owner.csrfToken, 'Own Org');

    const outsider = await signUp(context.app, { email: 'outsider@example.test' });
    await createOrganization(outsider.agent, outsider.csrfToken, 'Other Org');

    const socket = await connect(port, outsider.sessionCookie);
    await waitFor(socket, 'ready');

    const errorPromise = waitFor(socket, 'room:error');
    socket.emit('room:join', { room: `org:${organizationId}` });
    const error = (await errorPromise) as { code: string };
    expect(error.code).toBe('forbidden');
    socket.close();
  });

  it('writes an audit event when a socket is rejected', async () => {
    const owner = await signUp(context.app, { email: 'owner@example.test' });
    const organizationId = await createOrganization(owner.agent, owner.csrfToken, 'Own Org');

    const outsider = await signUp(context.app, { email: 'outsider@example.test' });
    await createOrganization(outsider.agent, outsider.csrfToken, 'Other Org');

    const socket = await connect(port, outsider.sessionCookie);
    await waitFor(socket, 'ready');
    const errorPromise = waitFor(socket, 'room:error');
    socket.emit('room:join', { room: `project:${organizationId}` });
    await errorPromise;
    socket.close();

    const auditEvents = await waitForAuditEvent(context, 'SOCKET_REJECTED');
    expect(auditEvents.length).toBeGreaterThan(0);
  });
});
