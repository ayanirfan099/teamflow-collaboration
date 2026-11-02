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

describe('comments, presence and sessions', () => {
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
      .send({ title: 'Discussed task', boardId, columnId })
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

  /** Adds a member to the organization and returns their agent. */
  async function addMember(
    space: Workspace,
    email: string,
    role: 'ADMIN' | 'MEMBER' | 'VIEWER' = 'MEMBER',
  ) {
    const member = await signUp(context.app, { email });
    const invitation = await space.agent
      .post(`/api/v1/organizations/${space.organizationId}/invitations`)
      .set('x-csrf-token', space.csrfToken)
      .send({ email, role })
      .expect(201);
    const token = invitation.body.data.acceptUrl.split('/').pop() as string;

    const memberCsrf = await member.agent.get('/api/v1/auth/csrf').expect(200);
    await member.agent
      .post('/api/v1/invitations/accept')
      .set('x-csrf-token', memberCsrf.body.data.token)
      .send({ token })
      .expect(201);
    const sessionCsrf = await member.agent.get('/api/v1/auth/csrf').expect(200);

    return { agent: member.agent, csrfToken: sessionCsrf.body.data.token as string };
  }

  it('edits a comment and records the change in the activity feed', async () => {
    const space = await workspace();

    const comment = await space.agent
      .post(`/api/v1/organizations/${space.organizationId}/tasks/${space.taskId}/comments`)
      .set('x-csrf-token', space.csrfToken)
      .send({ body: 'First version of the copy' })
      .expect(201);

    const updated = await space.agent
      .patch(`/api/v1/organizations/${space.organizationId}/comments/${comment.body.data.id}`)
      .set('x-csrf-token', space.csrfToken)
      .send({ body: 'Second version of the copy' })
      .expect(200);

    expect(updated.body.data.body).toBe('Second version of the copy');
    expect(updated.body.data.updatedAt).not.toBe(comment.body.data.createdAt);

    const activity = await space.agent
      .get(`/api/v1/organizations/${space.organizationId}/tasks/${space.taskId}/activity`)
      .expect(200);
    expect(activity.body.data[0].type).toBe('COMMENT_UPDATED');
  });

  it('refuses to edit the comment of somebody else', async () => {
    const space = await workspace();
    const member = await addMember(space, 'member@example.test');

    const comment = await space.agent
      .post(`/api/v1/organizations/${space.organizationId}/tasks/${space.taskId}/comments`)
      .set('x-csrf-token', space.csrfToken)
      .send({ body: 'Owned by the owner' })
      .expect(201);

    const response = await member.agent
      .patch(`/api/v1/organizations/${space.organizationId}/comments/${comment.body.data.id}`)
      .set('x-csrf-token', member.csrfToken)
      .send({ body: 'Changed by somebody else' })
      .expect(403);
    expect(response.body.error.code).toBe('forbidden');
  });

  it('notifies a member that was mentioned by an edit', async () => {
    const space = await workspace();
    const member = await addMember(space, 'member@example.test');

    const members = await space.agent
      .get(`/api/v1/organizations/${space.organizationId}/members`)
      .expect(200);
    const memberEntry = members.body.data.find(
      (entry: { email: string }) => entry.email === 'member@example.test',
    );

    const comment = await space.agent
      .post(`/api/v1/organizations/${space.organizationId}/tasks/${space.taskId}/comments`)
      .set('x-csrf-token', space.csrfToken)
      .send({ body: 'An initial note' })
      .expect(201);

    await space.agent
      .patch(`/api/v1/organizations/${space.organizationId}/comments/${comment.body.data.id}`)
      .set('x-csrf-token', space.csrfToken)
      .send({ body: `Now with a mention @[Member](user:${memberEntry.userId})` })
      .expect(200);

    const notifications = await member.agent
      .get(`/api/v1/organizations/${space.organizationId}/notifications`)
      .expect(200);
    expect(notifications.body.data).toHaveLength(1);
    expect(notifications.body.data[0].type).toBe('MENTION');
  });

  it('archives a task and hides it from the default board view', async () => {
    const space = await workspace();

    const task = await space.agent
      .get(`/api/v1/organizations/${space.organizationId}/tasks/${space.taskId}`)
      .expect(200);

    const archived = await space.agent
      .patch(`/api/v1/organizations/${space.organizationId}/tasks/${space.taskId}`)
      .set('x-csrf-token', space.csrfToken)
      .send({ status: 'ARCHIVED', version: task.body.data.version })
      .expect(200);
    expect(archived.body.data.status).toBe('ARCHIVED');

    const open = await space.agent
      .get(`/api/v1/organizations/${space.organizationId}/tasks?status=open`)
      .expect(200);
    expect(open.body.data).toHaveLength(0);

    const archivedList = await space.agent
      .get(`/api/v1/organizations/${space.organizationId}/tasks?status=archived`)
      .expect(200);
    expect(archivedList.body.data).toHaveLength(1);

    const activity = await space.agent
      .get(`/api/v1/organizations/${space.organizationId}/tasks/${space.taskId}/activity`)
      .expect(200);
    expect(activity.body.data[0].type).toBe('TASK_ARCHIVED');
  });

  it('restores an archived task', async () => {
    const space = await workspace();
    const task = await space.agent
      .get(`/api/v1/organizations/${space.organizationId}/tasks/${space.taskId}`)
      .expect(200);

    const archived = await space.agent
      .patch(`/api/v1/organizations/${space.organizationId}/tasks/${space.taskId}`)
      .set('x-csrf-token', space.csrfToken)
      .send({ status: 'ARCHIVED', version: task.body.data.version })
      .expect(200);

    const restored = await space.agent
      .patch(`/api/v1/organizations/${space.organizationId}/tasks/${space.taskId}`)
      .set('x-csrf-token', space.csrfToken)
      .send({ status: 'OPEN', version: archived.body.data.version })
      .expect(200);
    expect(restored.body.data.status).toBe('OPEN');
  });

  it('keeps the search filter while it paginates', async () => {
    const space = await workspace();
    for (let index = 0; index < 4; index += 1) {
      await space.agent
        .post(`/api/v1/organizations/${space.organizationId}/tasks`)
        .set('x-csrf-token', space.csrfToken)
        .send({
          title: `Searchable task ${index}`,
          boardId: space.boardId,
          columnId: space.columnId,
        })
        .expect(201);
    }

    const firstPage = await space.agent
      .get(`/api/v1/organizations/${space.organizationId}/tasks?q=Searchable&limit=2&status=all`)
      .expect(200);
    expect(firstPage.body.data).toHaveLength(2);
    expect(firstPage.body.meta.hasMore).toBe(true);

    const secondPage = await space.agent
      .get(
        `/api/v1/organizations/${space.organizationId}/tasks?q=Searchable&limit=2&status=all&cursor=${encodeURIComponent(
          firstPage.body.meta.nextCursor,
        )}`,
      )
      .expect(200);
    expect(secondPage.body.data).toHaveLength(2);
    for (const task of secondPage.body.data) {
      expect(task.title).toContain('Searchable');
    }
  });

  it('filters tasks by assignee, label and priority', async () => {
    const space = await workspace();
    const member = await addMember(space, 'member@example.test');
    const members = await space.agent
      .get(`/api/v1/organizations/${space.organizationId}/members`)
      .expect(200);
    const memberEntry = members.body.data.find(
      (entry: { email: string }) => entry.email === 'member@example.test',
    );

    const label = await space.agent
      .post(`/api/v1/organizations/${space.organizationId}/labels`)
      .set('x-csrf-token', space.csrfToken)
      .send({ name: 'Design', color: '#b24a2e' })
      .expect(201);

    const task = await space.agent
      .get(`/api/v1/organizations/${space.organizationId}/tasks/${space.taskId}`)
      .expect(200);

    await space.agent
      .patch(`/api/v1/organizations/${space.organizationId}/tasks/${space.taskId}`)
      .set('x-csrf-token', space.csrfToken)
      .send({
        priority: 'URGENT',
        assigneeIds: [memberEntry.userId],
        labelIds: [label.body.data.id],
        version: task.body.data.version,
      })
      .expect(200);

    const byAssignee = await space.agent
      .get(`/api/v1/organizations/${space.organizationId}/tasks?assigneeId=${memberEntry.userId}`)
      .expect(200);
    expect(byAssignee.body.data).toHaveLength(1);

    const byLabel = await space.agent
      .get(`/api/v1/organizations/${space.organizationId}/tasks?labelIds=${label.body.data.id}`)
      .expect(200);
    expect(byLabel.body.data).toHaveLength(1);

    const byPriority = await space.agent
      .get(`/api/v1/organizations/${space.organizationId}/tasks?priority=URGENT`)
      .expect(200);
    expect(byPriority.body.data).toHaveLength(1);

    const noMatch = await space.agent
      .get(`/api/v1/organizations/${space.organizationId}/tasks?priority=LOW`)
      .expect(200);
    expect(noMatch.body.data).toHaveLength(0);
    void member;
  });

  it('shows an empty presence list for a task nobody watches', async () => {
    const space = await workspace();
    const presence = await space.agent
      .get(`/api/v1/organizations/${space.organizationId}/tasks/${space.taskId}/presence`)
      .expect(200);
    expect(presence.body.data).toEqual([]);
  });

  it('never writes the presence into the activity feed or the audit log', async () => {
    const space = await workspace();
    await space.agent
      .get(`/api/v1/organizations/${space.organizationId}/tasks/${space.taskId}/presence`)
      .expect(200);

    const activity = await space.agent
      .get(`/api/v1/organizations/${space.organizationId}/activity`)
      .expect(200);
    for (const event of activity.body.data) {
      expect(String(event.type)).not.toContain('PRESENCE');
    }

    const audit = await space.agent
      .get(`/api/v1/organizations/${space.organizationId}/audit`)
      .expect(200);
    for (const event of audit.body.data) {
      expect(String(event.action)).not.toContain('PRESENCE');
    }
  });

  it('lists the sessions and revokes all of them', async () => {
    const space = await workspace();
    // A second session of the same user.
    await signInAgain(context.app, 'owner@example.test');

    const sessions = await space.agent.get('/api/v1/auth/sessions').expect(200);
    expect(sessions.body.data.length).toBeGreaterThanOrEqual(2);

    const revoked = await space.agent
      .post('/api/v1/auth/logout-all')
      .set('x-csrf-token', space.csrfToken)
      .expect(201);
    expect(revoked.body.data.revokedSessions).toBeGreaterThanOrEqual(2);

    // The session of this agent is revoked as well.
    await space.agent.get('/api/v1/auth/me').expect(401);
  });

  it('lets an admin read the audit log but not a member', async () => {
    const space = await workspace();
    const admin = await addMember(space, 'admin@example.test', 'ADMIN');
    const member = await addMember(space, 'member@example.test');

    await admin.agent.get(`/api/v1/organizations/${space.organizationId}/audit`).expect(200);

    const response = await member.agent
      .get(`/api/v1/organizations/${space.organizationId}/audit`)
      .expect(403);
    expect(response.body.error.code).toBe('forbidden');
  });
});

/** Signs the same user in again, so a second session exists. */
async function signInAgain(app: Parameters<typeof signUp>[0], email: string): Promise<void> {
  const agent = (await import('supertest')).default.agent(app.getHttpServer());
  const csrf = await agent.get('/api/v1/auth/csrf').expect(200);
  await agent
    .post('/api/v1/auth/login')
    .set('x-csrf-token', csrf.body.data.token)
    .send({ email, password: 'SuperSecret!2026' })
    .expect(201);
}
