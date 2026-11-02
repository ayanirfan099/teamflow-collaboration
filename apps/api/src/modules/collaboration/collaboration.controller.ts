import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  activityQuerySchema,
  commentQuerySchema,
  createCommentRequestSchema,
  markNotificationsReadRequestSchema,
  notificationQuerySchema,
  updateCommentRequestSchema,
} from '@teamflow/contracts';
import { PrismaClient } from '@teamflow/database';
import { CurrentUser, RequireCapability, Tenant } from '../../common/decorators';
import { AppException } from '../../common/errors';
import { decodeCursor, encodeCursor } from '../../common/pagination/cursor';
import { AuthenticatedUser, TenantContext } from '../../common/types';
import { parse } from '../../common/validation/parse';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { CommentsService } from './comments.service';
import { NotificationsService } from './notifications.service';

@Controller('organizations/:organizationId')
export class CollaborationController {
  constructor(
    private readonly comments: CommentsService,
    private readonly notifications: NotificationsService,
    private readonly prisma: PrismaClient,
    private readonly realtime: RealtimeGateway,
  ) {}

  @Get('tasks/:taskId/comments')
  @RequireCapability('comment:read')
  async listComments(
    @Tenant() tenant: TenantContext,
    @Param('taskId') taskId: string,
    @Query() query: unknown,
  ) {
    const params = parse(commentQuerySchema, query);
    const data = await this.comments.list(tenant, taskId, params.limit ?? 50);
    return { data, meta: { limit: params.limit ?? 50 } };
  }

  @Post('tasks/:taskId/comments')
  @RequireCapability('comment:create')
  async createComment(
    @Tenant() tenant: TenantContext,
    @Param('taskId') taskId: string,
    @Body() body: unknown,
  ) {
    const input = parse(createCommentRequestSchema, body);
    return { data: await this.comments.create(tenant, taskId, input.body) };
  }

  @Patch('comments/:commentId')
  @RequireCapability('comment:update')
  async updateComment(
    @Tenant() tenant: TenantContext,
    @Param('commentId') commentId: string,
    @Body() body: unknown,
  ) {
    const input = parse(updateCommentRequestSchema, body);
    return { data: await this.comments.update(tenant, commentId, input.body) };
  }

  @Delete('comments/:commentId')
  @RequireCapability('comment:delete')
  async removeComment(@Tenant() tenant: TenantContext, @Param('commentId') commentId: string) {
    await this.comments.remove(tenant, commentId);
    return { data: { id: commentId, deleted: true } };
  }

  @Get('tasks/:taskId/activity')
  @RequireCapability('task:read')
  async taskActivity(
    @Tenant() tenant: TenantContext,
    @Param('taskId') taskId: string,
    @Query() query: unknown,
  ) {
    const params = parse(activityQuerySchema, query);
    return this.activityList(tenant, { ...params, taskId });
  }

  /**
   * The ephemeral presence of a task.
   *
   * Presence is never persisted and never audited — it only says who has the task open right
   * now.
   */
  @Get('tasks/:taskId/presence')
  @RequireCapability('task:read')
  async taskPresence(@Tenant() tenant: TenantContext, @Param('taskId') taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, organizationId: tenant.organizationId },
      select: { id: true },
    });
    if (!task) {
      throw AppException.notFound('task');
    }
    return { data: this.realtime.presenceOf(taskId) };
  }

  @Get('activity')
  @RequireCapability('project:read')
  async organizationActivity(@Tenant() tenant: TenantContext, @Query() query: unknown) {
    const params = parse(activityQuerySchema, query);
    return this.activityList(tenant, params);
  }

  @Get('notifications')
  @RequireCapability('notification:read')
  async listNotifications(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: unknown,
  ) {
    const params = parse(notificationQuerySchema, query);
    const result = await this.notifications.list(tenant, user.id, {
      unreadOnly: params.unreadOnly ?? false,
      limit: params.limit ?? 25,
    });
    return {
      data: result.data,
      meta: { limit: params.limit ?? 25, hasMore: result.hasMore, unreadCount: result.unreadCount },
    };
  }

  @Post('notifications/read')
  @RequireCapability('notification:read')
  async markRead(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const input = parse(markNotificationsReadRequestSchema, body);
    const updated = await this.notifications.markRead(tenant, user.id, input.ids, input.all);
    return { data: { updated } };
  }

  /** The member directory: people of the organization that can be mentioned. */
  @Get('members/search')
  @RequireCapability('member:read')
  async searchMembers(@Tenant() tenant: TenantContext, @Query('q') q?: string) {
    const query = (q ?? '').trim();
    if (query.length < 2) {
      return { data: [] };
    }
    const memberships = await this.prisma.membership.findMany({
      where: {
        organizationId: tenant.organizationId,
        user: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
          ],
        },
      },
      take: 10,
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    return {
      data: memberships.map((membership) => ({
        id: membership.user.id,
        name: membership.user.name,
        email: membership.user.email,
      })),
    };
  }

  /** The My Work dashboard: assigned tasks grouped by deadline and project progress. */
  @Get('dashboard')
  @RequireCapability('project:read')
  async dashboard(@Tenant() tenant: TenantContext, @CurrentUser() user: AuthenticatedUser) {
    const now = new Date();
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    const endOfWeek = new Date(now);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    const [assigned, overdue, dueSoon, recentlyCompleted, projects] = await Promise.all([
      this.prisma.task.findMany({
        where: {
          organizationId: tenant.organizationId,
          status: 'OPEN',
          assignees: { some: { userId: user.id } },
        },
        orderBy: [{ dueDate: 'asc' }, { position: 'asc' }],
        take: 50,
        include: {
          assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
          labels: { include: { label: true } },
        },
      }),
      this.prisma.task.count({
        where: {
          organizationId: tenant.organizationId,
          status: 'OPEN',
          dueDate: { lt: now },
          assignees: { some: { userId: user.id } },
        },
      }),
      this.prisma.task.count({
        where: {
          organizationId: tenant.organizationId,
          status: 'OPEN',
          dueDate: { gte: now, lte: endOfWeek },
          assignees: { some: { userId: user.id } },
        },
      }),
      this.prisma.task.count({
        where: {
          organizationId: tenant.organizationId,
          status: 'DONE',
          assignees: { some: { userId: user.id } },
          completedAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      this.prisma.project.findMany({
        where: { organizationId: tenant.organizationId, status: 'ACTIVE' },
        orderBy: { updatedAt: 'desc' },
        take: 12,
        include: {
          _count: { select: { tasks: true } },
          tasks: { where: { status: 'DONE' }, select: { id: true } },
        },
      }),
    ]);

    return {
      data: {
        assigned: assigned.map((task) => ({
          id: task.id,
          organizationId: task.organizationId,
          projectId: task.projectId,
          boardId: task.boardId,
          columnId: task.columnId,
          number: task.number,
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          dueDate: task.dueDate?.toISOString() ?? null,
          completedAt: task.completedAt?.toISOString() ?? null,
          assignees: task.assignees.map((assignee) => ({
            userId: assignee.user.id,
            name: assignee.user.name,
            email: assignee.user.email,
          })),
          labels: task.labels.map((entry) => ({
            id: entry.label.id,
            organizationId: entry.label.organizationId,
            name: entry.label.name,
            color: entry.label.color,
            createdAt: entry.label.createdAt.toISOString(),
          })),
          createdById: task.createdById,
          createdAt: task.createdAt.toISOString(),
          updatedAt: task.updatedAt.toISOString(),
          version: task.version,
        })),
        overdue,
        dueSoon,
        recentlyCompleted,
        projects: projects.map((project) => ({
          id: project.id,
          name: project.name,
          key: project.key,
          color: project.color,
          totalTasks: project._count.tasks,
          completedTasks: project.tasks.length,
          progress:
            project._count.tasks === 0
              ? 0
              : Math.round((project.tasks.length / project._count.tasks) * 100),
        })),
      },
    };
  }

  private async activityList(
    tenant: TenantContext,
    params: { taskId?: string; limit?: number; cursor?: string },
  ) {
    const limit = params.limit ?? 25;
    const cursor = decodeCursor(params.cursor);

    const events = await this.prisma.activityEvent.findMany({
      where: {
        organizationId: tenant.organizationId,
        ...(params.taskId ? { taskId: params.taskId } : {}),
        ...(cursor?.createdAt ? { createdAt: { lt: new Date(cursor.createdAt) } } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: { actor: { select: { id: true, name: true } } },
    });

    const hasMore = events.length > limit;
    const rows = hasMore ? events.slice(0, limit) : events;
    const data = rows.map((event) => ({
      id: event.id,
      organizationId: event.organizationId,
      projectId: event.projectId,
      taskId: event.taskId,
      type: event.type,
      actorId: event.actorId,
      actorName: event.actor.name,
      summary: event.summary,
      payload: (event.payload as Record<string, unknown> | null) ?? null,
      createdAt: event.createdAt.toISOString(),
    }));

    const last = rows[rows.length - 1];
    return {
      data,
      meta: {
        limit,
        hasMore,
        nextCursor:
          hasMore && last ? encodeCursor({ createdAt: last.createdAt.toISOString() }) : null,
      },
    };
  }
}
