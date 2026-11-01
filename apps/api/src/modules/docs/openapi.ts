import {
  OpenApiGeneratorV31,
  OpenAPIRegistry,
  RouteConfig,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import {
  acceptInvitationRequestSchema,
  createInvitationRequestSchema,
  createOrganizationRequestSchema,
  createProjectRequestSchema,
  loginRequestSchema,
  registerRequestSchema,
  updateTaskRequestSchema,
  moveTaskRequestSchema,
  taskSchema,
  projectSchema,
  boardSchema,
  columnSchema,
  labelSchema,
  userSchema,
  membershipSchema,
  memberSchema,
  organizationSchema,
  invitationSchema,
  sessionSchema,
} from '@teamflow/contracts';

extendZodWithOpenApi(z);

/**
 * The OpenAPI document of the API.
 *
 * The request and response schemas are the Zod contracts of `@teamflow/contracts`, so the
 * document cannot drift from the validation that the API actually performs.
 */

const registry = new OpenAPIRegistry();

// The schemas of the shared contracts become the components of the document.
registry.register('User', userSchema);
registry.register('Membership', membershipSchema);
registry.register('Session', sessionSchema);
registry.register('Organization', organizationSchema);
registry.register('Member', memberSchema);
registry.register('Invitation', invitationSchema);
registry.register('Project', projectSchema);
registry.register('Board', boardSchema);
registry.register('Column', columnSchema);
registry.register('Label', labelSchema);
registry.register('Task', taskSchema);

registry.registerPath({
  method: 'get',
  path: '/auth/csrf',
  summary: 'Returns a CSRF token and sets the readable CSRF cookie.',
  responses: {
    200: {
      description: 'The CSRF token.',
      content: {
        'application/json': {
          schema: z.object({ data: z.object({ token: z.string() }) }),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/register',
  summary: 'Creates a user, a session and — optionally — an organization.',
  request: {
    body: {
      content: { 'application/json': { schema: registerRequestSchema } },
    },
  },
  responses: {
    201: {
      description: 'The new user and its memberships.',
      content: {
        'application/json': {
          schema: z.object({
            data: z.object({
              user: userSchema,
              memberships: z.array(membershipSchema),
            }),
          }),
        },
      },
    },
    409: { description: 'The email address is already taken.' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/login',
  summary: 'Creates a session and sets the opaque session cookie.',
  request: {
    body: { content: { 'application/json': { schema: loginRequestSchema } } },
  },
  responses: {
    200: {
      description: 'The signed-in user.',
      content: {
        'application/json': {
          schema: z.object({
            data: z.object({ user: userSchema, memberships: z.array(membershipSchema) }),
          }),
        },
      },
    },
    401: { description: 'The credentials are invalid.' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/logout',
  summary: 'Revokes the current session.',
  responses: { 204: { description: 'The session was revoked.' } },
});

registry.registerPath({
  method: 'get',
  path: '/auth/me',
  summary: 'Returns the current user, its memberships and the active session.',
  responses: {
    200: {
      description: 'The session of the current user.',
      content: {
        'application/json': {
          schema: z.object({
            data: z.object({
              user: userSchema,
              memberships: z.array(membershipSchema),
              activeSession: sessionSchema,
            }),
          }),
        },
      },
    },
    401: { description: 'No valid session.' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/organizations',
  summary: 'Lists the organizations of the current user.',
  responses: {
    200: {
      description: 'The organizations.',
      content: {
        'application/json': { schema: z.object({ data: z.array(organizationSchema) }) },
      },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/organizations',
  summary: 'Creates an organization; the creator becomes its owner.',
  request: {
    body: {
      content: { 'application/json': { schema: createOrganizationRequestSchema } },
    },
  },
  responses: {
    201: {
      description: 'The new organization.',
      content: {
        'application/json': { schema: z.object({ data: organizationSchema }) },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/organizations/{organizationId}/members',
  summary: 'Lists the members of an organization.',
  responses: {
    200: {
      description: 'The members.',
      content: { 'application/json': { schema: z.object({ data: z.array(memberSchema) }) } },
    },
    404: { description: 'The organization does not exist or is not accessible.' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/organizations/{organizationId}/invitations',
  summary: 'Invites a person to the organization.',
  request: {
    body: {
      content: { 'application/json': { schema: createInvitationRequestSchema } },
    },
  },
  responses: {
    201: {
      description: 'The invitation.',
      content: {
        'application/json': {
          schema: z.object({ data: invitationSchema.extend({ acceptUrl: z.string() }) }),
        },
      },
    },
    429: { description: 'The invitation rate limit was reached.' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/invitations/accept',
  summary: 'Accepts an invitation. The token can be used once.',
  request: {
    body: {
      content: { 'application/json': { schema: acceptInvitationRequestSchema } },
    },
  },
  responses: {
    200: { description: 'The invitation was accepted.' },
    410: { description: 'The invitation expired or was already used.' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/organizations/{organizationId}/projects',
  summary: 'Lists the projects of an organization.',
  responses: {
    200: {
      description: 'The projects.',
      content: { 'application/json': { schema: z.object({ data: z.array(projectSchema) }) } },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/organizations/{organizationId}/projects',
  summary: 'Creates a project with a default board and columns.',
  request: {
    body: { content: { 'application/json': { schema: createProjectRequestSchema } } },
  },
  responses: {
    201: {
      description: 'The new project.',
      content: { 'application/json': { schema: z.object({ data: projectSchema }) } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/organizations/{organizationId}/projects/{projectId}/boards',
  summary: 'Lists the boards of a project.',
  responses: {
    200: {
      description: 'The boards.',
      content: { 'application/json': { schema: z.object({ data: z.array(boardSchema) }) } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/organizations/{organizationId}/boards/{boardId}/columns',
  summary: 'Lists the columns of a board.',
  responses: {
    200: {
      description: 'The columns.',
      content: { 'application/json': { schema: z.object({ data: z.array(columnSchema) }) } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/organizations/{organizationId}/tasks',
  summary: 'Lists the tasks of an organization, optionally filtered.',
  responses: {
    200: {
      description: 'The tasks.',
      content: { 'application/json': { schema: z.object({ data: z.array(taskSchema) }) } },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/organizations/{organizationId}/tasks',
  summary: 'Creates a task.',
  responses: {
    201: {
      description: 'The new task.',
      content: { 'application/json': { schema: z.object({ data: taskSchema }) } },
    },
  },
});

registry.registerPath({
  method: 'patch',
  path: '/organizations/{organizationId}/tasks/{taskId}',
  summary: 'Updates a task. The `version` field implements optimistic concurrency.',
  request: {
    body: { content: { 'application/json': { schema: updateTaskRequestSchema } } },
  },
  responses: {
    200: {
      description: 'The updated task.',
      content: { 'application/json': { schema: z.object({ data: taskSchema }) } },
    },
    409: { description: 'The task was changed by somebody else.' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/organizations/{organizationId}/tasks/{taskId}/move',
  summary: 'Moves a task to a column and computes its sparse position.',
  request: {
    body: { content: { 'application/json': { schema: moveTaskRequestSchema } } },
  },
  responses: {
    200: {
      description: 'The moved task.',
      content: { 'application/json': { schema: z.object({ data: taskSchema }) } },
    },
    409: { description: 'The task was changed by somebody else.' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/organizations/{organizationId}/tasks/{taskId}/comments',
  summary: 'Lists the comments of a task.',
  responses: {
    200: {
      description: 'The comments.',
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(
              z.object({
                id: z.string(),
                taskId: z.string(),
                body: z.string(),
                authorId: z.string(),
                authorName: z.string(),
                mentions: z.array(z.object({ id: z.string(), name: z.string() })),
                createdAt: z.string(),
              }),
            ),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/organizations/{organizationId}/notifications',
  summary: 'Lists the notifications of the current user.',
  responses: {
    200: {
      description: 'The notifications and the number of unread ones.',
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(
              z.object({
                id: z.string(),
                title: z.string(),
                body: z.string().nullable(),
                readAt: z.string().nullable(),
                createdAt: z.string(),
              }),
            ),
            meta: z.object({ unreadCount: z.number(), hasMore: z.boolean() }),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/organizations/{organizationId}/dashboard',
  summary: 'The My Work dashboard: assigned tasks, deadlines and project progress.',
  responses: {
    200: { description: 'The dashboard.' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/organizations/{organizationId}/activity',
  summary: 'The activity timeline of an organization.',
  responses: {
    200: { description: 'The activity events.' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/health/live',
  summary: 'Liveness probe.',
  responses: { 200: { description: 'The process is alive.' } },
});

registry.registerPath({
  method: 'get',
  path: '/health/ready',
  summary: 'Readiness probe — checks the database connection.',
  responses: {
    200: { description: 'The service is ready.' },
    503: { description: 'A dependency is not available.' },
  },
});

/** The parameters that every organization scoped path carries. */
const organizationIdParameter = {
  name: 'organizationId',
  in: 'path',
  required: true,
  schema: { type: 'string', format: 'uuid' },
} as const;

const organizationIdParameters = [organizationIdParameter];

registry.registerComponent('securitySchemes', 'sessionCookie', {
  type: 'apiKey',
  in: 'cookie',
  name: 'tf_session',
});

registry.registerComponent('securitySchemes', 'csrfHeader', {
  type: 'apiKey',
  in: 'header',
  name: 'x-csrf-token',
});

/** Builds the OpenAPI document. */
export function buildOpenApiDocument(): ReturnType<OpenApiGeneratorV31['generateDocument']> {
  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'TeamFlow API',
      version: '1.0.0',
      description:
        'The HTTP API of TeamFlow. Every organization scoped path is tenant isolated: a ' +
        'resource of another organization resolves to 404, never to data. Requests that change ' +
        'state need the `x-csrf-token` header, the value of the readable `tf_csrf` cookie.',
      license: { name: 'MIT' },
    },
    servers: [{ url: '/api/v1', description: 'This API' }],
    tags: [
      { name: 'auth', description: 'Sessions, registration and CSRF' },
      { name: 'organizations', description: 'Organizations, members and invitations' },
      { name: 'projects', description: 'Projects, boards and columns' },
      { name: 'tasks', description: 'Tasks and their order' },
      { name: 'collaboration', description: 'Comments, mentions, notifications and activity' },
      { name: 'health', description: 'Liveness and readiness' },
    ],
  });
}

/** The path parameters that are shared by the organization scoped paths. */
export const sharedParameters = { organizationIdParameters };
export type SharedRoute = RouteConfig;
