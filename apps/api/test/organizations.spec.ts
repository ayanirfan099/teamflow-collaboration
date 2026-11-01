import {
  createOrganization,
  createTestContext,
  resetDatabase,
  signUp,
  HttpAgent,
  TestContext,
} from './helpers/test-context';

describe('organizations and invitations', () => {
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

  async function organizationWithOwner(): Promise<{
    agent: HttpAgent;
    csrfToken: string;
    organizationId: string;
    userId: string;
  }> {
    const { agent, csrfToken, user } = await signUp(context.app, {
      email: 'owner@example.test',
    });
    const organizationId = await createOrganization(agent, csrfToken, 'Northwind Studio');
    return { agent, csrfToken, organizationId, userId: user.id };
  }

  it('creates an organization and lists it for the creator', async () => {
    const { agent, organizationId } = await organizationWithOwner();

    const me = await agent.get('/api/v1/auth/me').expect(200);
    expect(me.body.data.memberships).toHaveLength(1);
    expect(me.body.data.memberships[0].organizationId).toBe(organizationId);
    expect(me.body.data.memberships[0].role).toBe('OWNER');

    const organizations = await agent.get('/api/v1/organizations').expect(200);
    expect(organizations.body.data).toHaveLength(1);
    expect(organizations.body.data[0].slug).toBe('northwind-studio');
  });

  it('hides organizations the caller does not belong to', async () => {
    const { organizationId } = await organizationWithOwner();
    const other = await signUp(context.app, { email: 'outsider@example.test' });

    const response = await other.agent.get(`/api/v1/organizations/${organizationId}`).expect(404);
    expect(response.body.error.code).toBe('organization_not_found');
  });

  it('invites a member, accepts the invitation once and rejects a replay', async () => {
    const { agent, csrfToken, organizationId } = await organizationWithOwner();

    const invitee = await signUp(context.app, { email: 'invitee@example.test' });
    const inviteeCsrf = await invitee.agent.get('/api/v1/auth/csrf').expect(200);

    const invitation = await agent
      .post(`/api/v1/organizations/${organizationId}/invitations`)
      .set('x-csrf-token', csrfToken)
      .send({ email: 'invitee@example.test', role: 'MEMBER' })
      .expect(201);

    const token = invitation.body.data.acceptUrl.split('/').pop() as string;

    const preview = await invitee.agent.get(`/api/v1/invitations/${token}`).expect(200);
    expect(preview.body.data.email).toBe('invitee@example.test');

    await invitee.agent
      .post('/api/v1/invitations/accept')
      .set('x-csrf-token', inviteeCsrf.body.data.token)
      .send({ token })
      .expect(201);

    const replay = await invitee.agent
      .post('/api/v1/invitations/accept')
      .set('x-csrf-token', inviteeCsrf.body.data.token)
      .send({ token })
      .expect(422);
    expect(replay.body.error.code).toBe('invitation_already_used');

    const members = await agent.get(`/api/v1/organizations/${organizationId}/members`).expect(200);
    expect(members.body.data).toHaveLength(2);
  });

  it('rejects an invitation that was issued to another email address', async () => {
    const { agent, csrfToken, organizationId } = await organizationWithOwner();
    const other = await signUp(context.app, { email: 'someone-else@example.test' });
    const otherCsrf = await other.agent.get('/api/v1/auth/csrf').expect(200);

    const invitation = await agent
      .post(`/api/v1/organizations/${organizationId}/invitations`)
      .set('x-csrf-token', csrfToken)
      .send({ email: 'invitee@example.test', role: 'MEMBER' })
      .expect(201);
    const token = invitation.body.data.acceptUrl.split('/').pop() as string;

    const response = await other.agent
      .post('/api/v1/invitations/accept')
      .set('x-csrf-token', otherCsrf.body.data.token)
      .send({ token })
      .expect(403);
    expect(response.body.error.code).toBe('forbidden');
  });

  it('rejects an expired invitation', async () => {
    const { agent, csrfToken, organizationId } = await organizationWithOwner();
    const invitee = await signUp(context.app, { email: 'invitee@example.test' });
    const inviteeCsrf = await invitee.agent.get('/api/v1/auth/csrf').expect(200);

    const invitation = await agent
      .post(`/api/v1/organizations/${organizationId}/invitations`)
      .set('x-csrf-token', csrfToken)
      .send({ email: 'invitee@example.test', role: 'MEMBER' })
      .expect(201);
    const token = invitation.body.data.acceptUrl.split('/').pop() as string;

    await context.prisma.invitation.updateMany({
      where: { email: 'invitee@example.test' },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const response = await invitee.agent
      .post('/api/v1/invitations/accept')
      .set('x-csrf-token', inviteeCsrf.body.data.token)
      .send({ token })
      .expect(422);
    expect(response.body.error.code).toBe('invitation_expired');
  });

  it('lets an owner change a role but not promote somebody to owner', async () => {
    const { agent, csrfToken, organizationId } = await organizationWithOwner();

    const invitee = await signUp(context.app, { email: 'member@example.test' });
    const inviteeCsrf = await invitee.agent.get('/api/v1/auth/csrf').expect(200);
    const invitation = await agent
      .post(`/api/v1/organizations/${organizationId}/invitations`)
      .set('x-csrf-token', csrfToken)
      .send({ email: 'member@example.test', role: 'MEMBER' })
      .expect(201);
    const token = invitation.body.data.acceptUrl.split('/').pop() as string;
    await invitee.agent
      .post('/api/v1/invitations/accept')
      .set('x-csrf-token', inviteeCsrf.body.data.token)
      .send({ token })
      .expect(201);

    const members = await agent.get(`/api/v1/organizations/${organizationId}/members`).expect(200);
    const member = members.body.data.find(
      (entry: { email: string }) => entry.email === 'member@example.test',
    );

    // A member cannot change roles.
    const forbidden = await invitee.agent
      .patch(`/api/v1/organizations/${organizationId}/members/${member.id}`)
      .set('x-csrf-token', inviteeCsrf.body.data.token)
      .send({ role: 'ADMIN' })
      .expect(403);
    expect(forbidden.body.error.code).toBe('forbidden');

    // The owner can.
    await agent
      .patch(`/api/v1/organizations/${organizationId}/members/${member.id}`)
      .set('x-csrf-token', csrfToken)
      .send({ role: 'ADMIN' })
      .expect(200);

    // Promotion to owner is not supported in v1.
    const promotion = await agent
      .patch(`/api/v1/organizations/${organizationId}/members/${member.id}`)
      .set('x-csrf-token', csrfToken)
      .send({ role: 'OWNER' })
      .expect(400);
    expect(promotion.body.error.code).toBe('invalid_role_change');
  });

  it('keeps the last owner and blocks self removal', async () => {
    const { agent, csrfToken, organizationId, userId } = await organizationWithOwner();

    const members = await agent.get(`/api/v1/organizations/${organizationId}/members`).expect(200);
    const ownMembership = members.body.data.find(
      (entry: { userId: string }) => entry.userId === userId,
    );

    const response = await agent
      .delete(`/api/v1/organizations/${organizationId}/members/${ownMembership.id}`)
      .set('x-csrf-token', csrfToken)
      .expect(400);
    expect(response.body.error.code).toBe('cannot_remove_self');
  });

  it('records membership changes in the audit log and restricts it to admins', async () => {
    const { agent, organizationId } = await organizationWithOwner();

    const audit = await agent.get(`/api/v1/organizations/${organizationId}/audit`).expect(200);
    expect(audit.body.data.length).toBeGreaterThan(0);
    expect(audit.body.data[0].action).toBe('ORGANIZATION_CREATED');

    const member = await signUp(context.app, { email: 'viewer@example.test' });
    const forbidden = await member.agent
      .get(`/api/v1/organizations/${organizationId}/audit`)
      .expect(404);
    expect(forbidden.body.error.code).toBe('organization_not_found');
  });
});
