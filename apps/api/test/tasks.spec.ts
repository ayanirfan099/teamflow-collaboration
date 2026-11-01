import {
  createOrganization,
  createTestContext,
  resetDatabase,
  signUp,
  HttpAgent,
  TestContext,
} from './helpers/test-context';

interface Workspace {
  agent: HttpAgent;
  csrfToken: string;
  organizationId: string;
  projectId: string;
  boardId: string;
  columns: Array<{ id: string; name: string }>;
}

describe('projects, boards and tasks', () => {
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

    return {
      agent,
      csrfToken,
      organizationId,
      projectId: project.body.data.id as string,
      boardId,
      columns: columns.body.data as Array<{ id: string; name: string }>,
    };
  }

  async function createTask(space: Workspace, title: string, columnIndex = 0) {
    const column = space.columns[columnIndex]!;
    const response = await space.agent
      .post(`/api/v1/organizations/${space.organizationId}/tasks`)
      .set('x-csrf-token', space.csrfToken)
      .send({ title, boardId: space.boardId, columnId: column.id })
      .expect(201);
    return response.body.data as {
      id: string;
      title: string;
      columnId: string;
      version: number;
      number: number;
    };
  }

  it('creates a project with a default board and columns', async () => {
    const space = await workspace();
    expect(space.columns.map((column) => column.name)).toEqual([
      'Backlog',
      'In progress',
      'In review',
      'Done',
    ]);

    const projects = await space.agent
      .get(`/api/v1/organizations/${space.organizationId}/projects`)
      .expect(200);
    expect(projects.body.data).toHaveLength(1);
    expect(projects.body.data[0].key).toBe('WEB');
    expect(projects.body.data[0].taskCount).toBe(0);
  });

  it('creates tasks with increasing numbers and keeps the board order', async () => {
    const space = await workspace();
    const first = await createTask(space, 'First task');
    const second = await createTask(space, 'Second task');
    const third = await createTask(space, 'Third task');

    expect(first.number).toBe(1);
    expect(second.number).toBe(2);
    expect(third.number).toBe(3);

    const tasks = await space.agent
      .get(`/api/v1/organizations/${space.organizationId}/tasks?boardId=${space.boardId}`)
      .expect(200);
    expect(tasks.body.data.map((task: { title: string }) => task.title)).toEqual([
      'First task',
      'Second task',
      'Third task',
    ]);
  });

  it('moves a task to another column without rewriting the other tasks', async () => {
    const space = await workspace();
    await createTask(space, 'First task');
    const second = await createTask(space, 'Second task');
    const third = await createTask(space, 'Third task');

    const before = await space.agent
      .get(`/api/v1/organizations/${space.organizationId}/tasks?boardId=${space.boardId}`)
      .expect(200);
    const untouched = before.body.data.find((task: { id: string }) => task.id === third.id);

    const move = await space.agent
      .post(`/api/v1/organizations/${space.organizationId}/tasks/${second.id}/move`)
      .set('x-csrf-token', space.csrfToken)
      .send({ columnId: space.columns[1]!.id, afterTaskId: null, version: second.version })
      .expect(201);

    expect(move.body.data.columnId).toBe(space.columns[1]!.id);
    expect(move.body.data.version).toBe(second.version + 1);

    const after = await space.agent
      .get(`/api/v1/organizations/${space.organizationId}/tasks?boardId=${space.boardId}`)
      .expect(200);
    const stillThere = after.body.data.find((task: { id: string }) => task.id === third.id);
    expect(stillThere.updatedAt).toBe(untouched.updatedAt);
    expect(
      after.body.data.filter(
        (task: { columnId: string }) => task.columnId === space.columns[1]!.id,
      ),
    ).toHaveLength(1);
  });

  it('rejects a conflicting edit with the current server state', async () => {
    const space = await workspace();
    const task = await createTask(space, 'Original title');

    await space.agent
      .patch(`/api/v1/organizations/${space.organizationId}/tasks/${task.id}`)
      .set('x-csrf-token', space.csrfToken)
      .send({ title: 'Updated title', version: task.version })
      .expect(200);

    const conflict = await space.agent
      .patch(`/api/v1/organizations/${space.organizationId}/tasks/${task.id}`)
      .set('x-csrf-token', space.csrfToken)
      .send({ title: 'Stale title', version: task.version })
      .expect(409);

    expect(conflict.body.error.code).toBe('conflict');
    expect(conflict.body.error.details.current.title).toBe('Updated title');
  });

  it('never exposes a task from another organization', async () => {
    const space = await workspace();
    const task = await createTask(space, 'Secret task');

    const other = await workspace('outsider@example.test');

    const response = await other.agent
      .get(`/api/v1/organizations/${other.organizationId}/tasks/${task.id}`)
      .expect(404);
    expect(response.body.error.code).toBe('task_not_found');

    const list = await other.agent
      .get(`/api/v1/organizations/${other.organizationId}/tasks`)
      .expect(200);
    expect(list.body.data).toHaveLength(0);
  });

  it('filters and searches tasks', async () => {
    const space = await workspace();
    await createTask(space, 'Audit the landing page content');
    await createTask(space, 'Fix the mobile navigation');

    const search = await space.agent
      .get(`/api/v1/organizations/${space.organizationId}/tasks?q=navigation`)
      .expect(200);
    expect(search.body.data).toHaveLength(1);
    expect(search.body.data[0].title).toBe('Fix the mobile navigation');

    const byColumn = await space.agent
      .get(`/api/v1/organizations/${space.organizationId}/tasks?columnId=${space.columns[0]!.id}`)
      .expect(200);
    expect(byColumn.body.data).toHaveLength(2);

    const byOtherColumn = await space.agent
      .get(`/api/v1/organizations/${space.organizationId}/tasks?columnId=${space.columns[2]!.id}`)
      .expect(200);
    expect(byOtherColumn.body.data).toHaveLength(0);
  });

  it('paginates with an opaque cursor', async () => {
    const space = await workspace();
    for (let index = 0; index < 5; index += 1) {
      await createTask(space, `Task ${index}`);
    }

    const firstPage = await space.agent
      .get(`/api/v1/organizations/${space.organizationId}/tasks?limit=2`)
      .expect(200);
    expect(firstPage.body.data).toHaveLength(2);
    expect(firstPage.body.meta.hasMore).toBe(true);

    const secondPage = await space.agent
      .get(
        `/api/v1/organizations/${space.organizationId}/tasks?limit=2&cursor=${encodeURIComponent(
          firstPage.body.meta.nextCursor,
        )}`,
      )
      .expect(200);
    expect(secondPage.body.data).toHaveLength(2);
    expect(secondPage.body.data[0].title).toBe('Task 2');
  });

  it('rejects an invalid page size', async () => {
    const space = await workspace();
    const response = await space.agent
      .get(`/api/v1/organizations/${space.organizationId}/tasks?limit=500`)
      .expect(400);
    expect(response.body.error.code).toBe('validation_failed');
  });

  it('lets a viewer read but not write', async () => {
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

    await viewer.agent.get(`/api/v1/organizations/${space.organizationId}/tasks`).expect(200);

    const forbidden = await viewer.agent
      .post(`/api/v1/organizations/${space.organizationId}/tasks`)
      .set('x-csrf-token', viewerSessionCsrf.body.data.token)
      .send({ title: 'Not allowed', boardId: space.boardId, columnId: space.columns[0]!.id })
      .expect(403);
    expect(forbidden.body.error.code).toBe('forbidden');
  });

  it('records activity for task changes', async () => {
    const space = await workspace();
    const task = await createTask(space, 'Tracked task');

    const activity = await space.agent
      .get(`/api/v1/organizations/${space.organizationId}/tasks/${task.id}/activity`)
      .expect(200);
    expect(activity.body.data.length).toBeGreaterThan(0);
    expect(activity.body.data[0].type).toBe('TASK_CREATED');
  });

  it('creates a comment, mentions a member and notifies them', async () => {
    const space = await workspace();
    const task = await createTask(space, 'Discussed task');

    const member = await signUp(context.app, { email: 'member@example.test' });
    const memberCsrf = await member.agent.get('/api/v1/auth/csrf').expect(200);
    const invitation = await space.agent
      .post(`/api/v1/organizations/${space.organizationId}/invitations`)
      .set('x-csrf-token', space.csrfToken)
      .send({ email: 'member@example.test', role: 'MEMBER' })
      .expect(201);
    const token = invitation.body.data.acceptUrl.split('/').pop() as string;
    await member.agent
      .post('/api/v1/invitations/accept')
      .set('x-csrf-token', memberCsrf.body.data.token)
      .send({ token })
      .expect(201);
    const memberSessionCsrf = await member.agent.get('/api/v1/auth/csrf').expect(200);

    const members = await space.agent
      .get(`/api/v1/organizations/${space.organizationId}/members`)
      .expect(200);
    const memberEntry = members.body.data.find(
      (entry: { email: string }) => entry.email === 'member@example.test',
    );

    const comment = await space.agent
      .post(`/api/v1/organizations/${space.organizationId}/tasks/${task.id}/comments`)
      .set('x-csrf-token', space.csrfToken)
      .send({ body: `Can you look at this? @[Member](user:${memberEntry.userId})` })
      .expect(201);

    expect(comment.body.data.mentions).toHaveLength(1);
    expect(comment.body.data.mentions[0].id).toBe(memberEntry.userId);
    expect(comment.body.data.body).toContain('@Member');

    const notifications = await member.agent
      .get(`/api/v1/organizations/${space.organizationId}/notifications`)
      .expect(200);
    expect(notifications.body.data).toHaveLength(1);
    expect(notifications.body.data[0].type).toBe('MENTION');
    expect(notifications.body.meta.unreadCount).toBe(1);

    await member.agent
      .post(`/api/v1/organizations/${space.organizationId}/notifications/read`)
      .set('x-csrf-token', memberSessionCsrf.body.data.token)
      .send({ all: true })
      .expect(201);

    const readNotifications = await member.agent
      .get(`/api/v1/organizations/${space.organizationId}/notifications`)
      .expect(200);
    expect(readNotifications.body.meta.unreadCount).toBe(0);
  });
});
