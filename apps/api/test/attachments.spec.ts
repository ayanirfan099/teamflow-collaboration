import {
  createOrganization,
  createTestContext,
  resetDatabase,
  signUp,
  type HttpAgent,
  type TestContext,
} from './helpers/test-context';

interface Workspace {
  agent: HttpAgent;
  csrfToken: string;
  organizationId: string;
  projectId: string;
  boardId: string;
  columnId: string;
  taskId: string;
}

const PNG_BYTES = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6360000002000100' +
    '05fe02fea7b1f5c0000000049454e44ae426082',
  'hex',
);

describe('attachments', () => {
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

  async function workspace(email = 'owner@example.test'): Promise<Workspace> {
    const { agent, csrfToken } = await signUp(context.app, { email });
    const organizationId = await createOrganization(agent, csrfToken, 'Northwind Studio');

    const project = await agent
      .post(`/api/v1/organizations/${organizationId}/projects`)
      .set('x-csrf-token', csrfToken)
      .send({ name: 'Website Redesign', key: 'WEB' })
      .expect(201);

    const boards = await agent
      .get(`/api/v1/organizations/${organizationId}/projects/${project.body.data.id}/boards`)
      .expect(200);
    const boardId = boards.body.data[0].id as string;

    const columns = await agent
      .get(`/api/v1/organizations/${organizationId}/boards/${boardId}/columns`)
      .expect(200);
    const columnId = columns.body.data[0].id as string;

    const task = await agent
      .post(`/api/v1/organizations/${organizationId}/tasks`)
      .set('x-csrf-token', csrfToken)
      .send({ title: 'Design the header', boardId, columnId })
      .expect(201);

    return {
      agent,
      csrfToken,
      organizationId,
      projectId: project.body.data.id as string,
      boardId,
      columnId,
      taskId: task.body.data.id as string,
    };
  }

  it('uploads an attachment and lists it for the task', async () => {
    const space = await workspace();

    const upload = await space.agent
      .post(`/api/v1/organizations/${space.organizationId}/tasks/${space.taskId}/attachments`)
      .set('x-csrf-token', space.csrfToken)
      .attach('file', PNG_BYTES, { filename: 'header.png', contentType: 'image/png' })
      .expect(201);

    expect(upload.body.data.fileName).toBe('header.png');
    expect(upload.body.data.contentType).toBe('image/png');
    expect(upload.body.data.size).toBe(PNG_BYTES.length);
    // The storage key never leaves the server.
    expect(upload.body.data.storageKey).toBeUndefined();

    const list = await space.agent
      .get(`/api/v1/organizations/${space.organizationId}/tasks/${space.taskId}/attachments`)
      .expect(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].id).toBe(upload.body.data.id);
  });

  it('downloads the file as an attachment and never inline', async () => {
    const space = await workspace();
    const upload = await space.agent
      .post(`/api/v1/organizations/${space.organizationId}/tasks/${space.taskId}/attachments`)
      .set('x-csrf-token', space.csrfToken)
      .attach('file', PNG_BYTES, { filename: 'header.png', contentType: 'image/png' })
      .expect(201);

    const download = await space.agent
      .get(
        `/api/v1/organizations/${space.organizationId}/attachments/${upload.body.data.id}/download`,
      )
      .expect(200);

    expect(download.headers['content-type']).toBe('application/octet-stream');
    expect(download.headers['x-content-type-options']).toBe('nosniff');
    expect(download.headers['content-disposition']).toContain('attachment;');
    expect(download.headers['content-disposition']).toContain('header.png');
    expect(Buffer.from(download.body).equals(PNG_BYTES)).toBe(true);
  });

  it('never exposes an attachment of another organization', async () => {
    const space = await workspace();
    const upload = await space.agent
      .post(`/api/v1/organizations/${space.organizationId}/tasks/${space.taskId}/attachments`)
      .set('x-csrf-token', space.csrfToken)
      .attach('file', PNG_BYTES, { filename: 'header.png', contentType: 'image/png' })
      .expect(201);

    const outsider = await workspace('outsider@example.test');

    const response = await outsider.agent
      .get(
        `/api/v1/organizations/${outsider.organizationId}/attachments/${upload.body.data.id}/download`,
      )
      .expect(404);
    expect(response.body.error.code).toBe('attachment_not_found');
  });

  it('rejects a content type outside the allowlist', async () => {
    const space = await workspace();

    const response = await space.agent
      .post(`/api/v1/organizations/${space.organizationId}/tasks/${space.taskId}/attachments`)
      .set('x-csrf-token', space.csrfToken)
      .attach('file', Buffer.from('#!/bin/sh\nrm -rf /'), {
        filename: 'payload.sh',
        contentType: 'application/x-sh',
      })
      .expect(415);

    expect(response.body.error.code).toBe('unsupported_media_type');
  });

  it('rejects a file whose bytes do not match the declared content type', async () => {
    const space = await workspace();

    const response = await space.agent
      .post(`/api/v1/organizations/${space.organizationId}/tasks/${space.taskId}/attachments`)
      .set('x-csrf-token', space.csrfToken)
      .attach('file', PNG_BYTES, { filename: 'header.png', contentType: 'application/pdf' })
      .expect(415);

    expect(response.body.error.code).toBe('unsupported_media_type');
  });

  it('rejects an upload without a file', async () => {
    const space = await workspace();

    const response = await space.agent
      .post(`/api/v1/organizations/${space.organizationId}/tasks/${space.taskId}/attachments`)
      .set('x-csrf-token', space.csrfToken)
      .expect(400);

    expect(response.body.error.code).toBe('validation_failed');
  });

  it('sanitises the file name and never uses it as a path', async () => {
    const space = await workspace();

    const upload = await space.agent
      .post(`/api/v1/organizations/${space.organizationId}/tasks/${space.taskId}/attachments`)
      .set('x-csrf-token', space.csrfToken)
      .attach('file', PNG_BYTES, {
        filename: '../../etc/passwd.png',
        contentType: 'image/png',
      })
      .expect(201);

    expect(upload.body.data.fileName).not.toContain('/');
    expect(upload.body.data.fileName).not.toContain('..');
  });

  it('records an activity event for the upload', async () => {
    const space = await workspace();
    await space.agent
      .post(`/api/v1/organizations/${space.organizationId}/tasks/${space.taskId}/attachments`)
      .set('x-csrf-token', space.csrfToken)
      .attach('file', PNG_BYTES, { filename: 'header.png', contentType: 'image/png' })
      .expect(201);

    const activity = await space.agent
      .get(`/api/v1/organizations/${space.organizationId}/tasks/${space.taskId}/activity`)
      .expect(200);
    expect(activity.body.data[0].type).toBe('ATTACHMENT_ADDED');
  });

  it('lets a viewer read but not upload', async () => {
    const space = await workspace();
    const viewer = await signUp(context.app, { email: 'viewer@example.test' });

    const invitation = await space.agent
      .post(`/api/v1/organizations/${space.organizationId}/invitations`)
      .set('x-csrf-token', space.csrfToken)
      .send({ email: 'viewer@example.test', role: 'VIEWER' })
      .expect(201);
    const token = invitation.body.data.acceptUrl.split('/').pop() as string;

    const viewerCsrf = await viewer.agent.get('/api/v1/auth/csrf').expect(200);
    await viewer.agent
      .post('/api/v1/invitations/accept')
      .set('x-csrf-token', viewerCsrf.body.data.token)
      .send({ token })
      .expect(201);
    const viewerSessionCsrf = await viewer.agent.get('/api/v1/auth/csrf').expect(200);

    await viewer.agent
      .get(`/api/v1/organizations/${space.organizationId}/tasks/${space.taskId}/attachments`)
      .expect(200);

    const forbidden = await viewer.agent
      .post(`/api/v1/organizations/${space.organizationId}/tasks/${space.taskId}/attachments`)
      .set('x-csrf-token', viewerSessionCsrf.body.data.token)
      .attach('file', PNG_BYTES, { filename: 'header.png', contentType: 'image/png' })
      .expect(403);
    expect(forbidden.body.error.code).toBe('forbidden');
  });

  it('removes an attachment', async () => {
    const space = await workspace();
    const upload = await space.agent
      .post(`/api/v1/organizations/${space.organizationId}/tasks/${space.taskId}/attachments`)
      .set('x-csrf-token', space.csrfToken)
      .attach('file', PNG_BYTES, { filename: 'header.png', contentType: 'image/png' })
      .expect(201);

    await space.agent
      .delete(`/api/v1/organizations/${space.organizationId}/attachments/${upload.body.data.id}`)
      .set('x-csrf-token', space.csrfToken)
      .expect(200);

    const list = await space.agent
      .get(`/api/v1/organizations/${space.organizationId}/tasks/${space.taskId}/attachments`)
      .expect(200);
    expect(list.body.data).toHaveLength(0);
  });
});
