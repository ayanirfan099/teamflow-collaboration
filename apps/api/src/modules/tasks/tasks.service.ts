import { Injectable } from '@nestjs/common';
import { TaskPriority, TaskStatus } from '@teamflow/contracts';
import {
  positionAtEnd,
  positionBetween,
  Prisma,
  PrismaClient,
  rebalancedPositions,
} from '@teamflow/database';
import { AppException } from '../../common/errors';
import { TenantContext } from '../../common/types';
import { ActivityService } from '../collaboration/activity.service';
import { NotificationsService } from '../collaboration/notifications.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

export interface TaskDto {
  id: string;
  organizationId: string;
  projectId: string;
  boardId: string;
  columnId: string;
  number: number;
  title: string;
  description: string | null;
  status: 'OPEN' | 'DONE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueDate: string | null;
  completedAt: string | null;
  assignees: Array<{ userId: string; name: string; email: string }>;
  labels: Array<{
    id: string;
    organizationId: string;
    name: string;
    color: string;
    createdAt: string;
  }>;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface TaskQuery {
  q?: string;
  boardId?: string;
  projectId?: string;
  columnId?: string;
  assigneeId?: string;
  labelIds?: string[];
  priority?: TaskPriority[];
  due?: 'overdue' | 'today' | 'week' | 'none';
  status: 'open' | 'done' | 'all';
  limit?: number;
  cursor?: string;
}

const taskInclude = {
  assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
  labels: { include: { label: true } },
} satisfies Prisma.TaskInclude;

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly activity: ActivityService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async list(tenant: TenantContext, query: TaskQuery) {
    const limit = query.limit ?? 25;
    const now = new Date();
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    const endOfWeek = new Date(now);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    const cursor = query.cursor ? this.decodeCursor(query.cursor) : null;

    const where: Prisma.TaskWhereInput = {
      organizationId: tenant.organizationId,
      ...(query.boardId ? { boardId: query.boardId } : {}),
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.columnId ? { columnId: query.columnId } : {}),
      ...(query.status === 'all' ? {} : { status: query.status === 'done' ? 'DONE' : 'OPEN' }),
      ...(query.assigneeId ? { assignees: { some: { userId: query.assigneeId } } } : {}),
      ...(query.labelIds && query.labelIds.length > 0
        ? { labels: { some: { labelId: { in: query.labelIds } } } }
        : {}),
      ...(query.priority && query.priority.length > 0 ? { priority: { in: query.priority } } : {}),
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: 'insensitive' } },
              { description: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.due === 'overdue'
        ? { dueDate: { lt: now } }
        : query.due === 'today'
          ? { dueDate: { gte: now, lte: endOfToday } }
          : query.due === 'week'
            ? { dueDate: { gte: now, lte: endOfWeek } }
            : query.due === 'none'
              ? { dueDate: null }
              : {}),
      ...(cursor
        ? {
            OR: [
              { position: { gt: BigInt(cursor.position) } },
              { position: BigInt(cursor.position), id: { gt: cursor.id ?? '' } },
            ],
          }
        : {}),
    };

    const tasks = await this.prisma.task.findMany({
      where,
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      include: taskInclude,
    });

    const hasMore = tasks.length > limit;
    const rows = hasMore ? tasks.slice(0, limit) : tasks;
    const data = rows.map((task) => this.toDto(task));
    const lastRow = rows[rows.length - 1];

    return {
      data,
      meta: {
        limit,
        hasMore,
        nextCursor:
          hasMore && lastRow
            ? this.encodeCursor({ position: lastRow.position.toString(), id: lastRow.id })
            : null,
      },
    };
  }

  async get(tenant: TenantContext, taskId: string): Promise<TaskDto> {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, organizationId: tenant.organizationId },
      include: taskInclude,
    });
    if (!task) {
      throw AppException.notFound('task');
    }
    return this.toDto(task);
  }

  async create(
    tenant: TenantContext,
    input: {
      title: string;
      description?: string;
      boardId: string;
      columnId: string;
      priority?: TaskPriority;
      dueDate?: string | null;
      assigneeIds?: string[];
      labelIds?: string[];
      afterTaskId?: string | null;
    },
  ): Promise<TaskDto> {
    const column = await this.prisma.column.findFirst({
      where: { id: input.columnId, organizationId: tenant.organizationId },
    });
    if (!column) {
      throw AppException.notFound('column');
    }
    const board = await this.prisma.board.findFirst({
      where: { id: input.boardId, organizationId: tenant.organizationId },
    });
    if (!board) {
      throw AppException.notFound('board');
    }

    const assigneeIds = await this.assertMembers(tenant, input.assigneeIds ?? []);
    const labelIds = await this.assertLabels(tenant, input.labelIds ?? []);

    // `undefined` appends at the end of the column, an explicit id inserts after that task.
    const position = await this.nextPosition(tenant, input.columnId, input.afterTaskId);

    const task = await this.prisma.$transaction(async (tx) => {
      const project = await tx.project.update({
        where: { id: board.projectId },
        data: { nextTaskNumber: { increment: 1 } },
      });

      return tx.task.create({
        data: {
          organizationId: tenant.organizationId,
          projectId: board.projectId,
          boardId: input.boardId,
          columnId: input.columnId,
          number: project.nextTaskNumber - 1,
          title: input.title,
          description: input.description ?? null,
          priority: input.priority ?? 'MEDIUM',
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          position,
          createdById: tenant.userId,
          assignees: {
            create: assigneeIds.map((userId) => ({
              organizationId: tenant.organizationId,
              userId,
            })),
          },
          labels: { create: labelIds.map((labelId) => ({ labelId })) },
        },
        include: taskInclude,
      });
    });

    const author = await this.prisma.user.findUnique({
      where: { id: tenant.userId },
      select: { name: true },
    });

    await this.activity.record({
      organizationId: tenant.organizationId,
      actorId: tenant.userId,
      type: 'TASK_CREATED',
      summary: `${author?.name ?? 'Someone'} created "${task.title}"`,
      projectId: task.projectId,
      taskId: task.id,
    });

    for (const userId of assigneeIds) {
      if (userId === tenant.userId) {
        continue;
      }
      await this.notifications.notify({
        organizationId: tenant.organizationId,
        userId,
        type: 'TASK_ASSIGNED',
        title: `${author?.name ?? 'Someone'} assigned you "${task.title}"`,
        link: `/organizations/${tenant.organizationId}/projects/${task.projectId}?task=${task.id}`,
        actorId: tenant.userId,
      });
    }

    const dto = this.toDto(task);
    this.realtime.emitToProject(task.projectId, 'task.created', {
      task: dto,
      actorId: tenant.userId,
    });
    return dto;
  }

  async update(
    tenant: TenantContext,
    taskId: string,
    input: {
      title?: string;
      description?: string | null;
      priority?: TaskPriority;
      dueDate?: string | null;
      status?: TaskStatus;
      columnId?: string;
      assigneeIds?: string[];
      labelIds?: string[];
      version: number;
    },
  ): Promise<TaskDto> {
    const current = await this.prisma.task.findFirst({
      where: { id: taskId, organizationId: tenant.organizationId },
      include: taskInclude,
    });
    if (!current) {
      throw AppException.notFound('task');
    }
    if (current.version !== input.version) {
      throw AppException.conflict(
        'conflict',
        'This task was changed by somebody else. Reload to see the latest version.',
        { current: this.toDto(current) },
      );
    }

    if (input.columnId && input.columnId !== current.columnId) {
      await this.assertColumn(tenant, input.columnId);
    }
    const assigneeIds =
      input.assigneeIds === undefined
        ? undefined
        : await this.assertMembers(tenant, input.assigneeIds);
    const labelIds =
      input.labelIds === undefined ? undefined : await this.assertLabels(tenant, input.labelIds);

    const completing = input.status === 'DONE' && current.status !== 'DONE';
    const reopening = input.status === 'OPEN' && current.status === 'DONE';

    const updated = await this.prisma.$transaction(async (tx) => {
      if (assigneeIds !== undefined) {
        await tx.taskAssignee.deleteMany({ where: { taskId } });
        await tx.taskAssignee.createMany({
          data: assigneeIds.map((userId) => ({
            organizationId: tenant.organizationId,
            taskId,
            userId,
          })),
        });
      }
      if (labelIds !== undefined) {
        await tx.taskLabel.deleteMany({ where: { taskId } });
        await tx.taskLabel.createMany({ data: labelIds.map((labelId) => ({ taskId, labelId })) });
      }

      return tx.task.update({
        where: { id: taskId },
        data: {
          ...(input.title === undefined ? {} : { title: input.title }),
          ...(input.description === undefined ? {} : { description: input.description }),
          ...(input.priority === undefined ? {} : { priority: input.priority }),
          ...(input.dueDate === undefined
            ? {}
            : { dueDate: input.dueDate ? new Date(input.dueDate) : null }),
          ...(input.status === undefined ? {} : { status: input.status }),
          ...(input.columnId === undefined ? {} : { columnId: input.columnId }),
          ...(completing ? { completedAt: new Date() } : {}),
          ...(reopening ? { completedAt: null } : {}),
          version: { increment: 1 },
        },
        include: taskInclude,
      });
    });

    const author = await this.prisma.user.findUnique({
      where: { id: tenant.userId },
      select: { name: true },
    });

    await this.activity.record({
      organizationId: tenant.organizationId,
      actorId: tenant.userId,
      type: completing ? 'TASK_COMPLETED' : reopening ? 'TASK_REOPENED' : 'TASK_UPDATED',
      summary: completing
        ? `${author?.name ?? 'Someone'} completed "${updated.title}"`
        : reopening
          ? `${author?.name ?? 'Someone'} reopened "${updated.title}"`
          : `${author?.name ?? 'Someone'} updated "${updated.title}"`,
      projectId: updated.projectId,
      taskId: updated.id,
    });

    if (assigneeIds !== undefined) {
      const previous = current.assignees.map((assignee) => assignee.userId);
      for (const userId of assigneeIds) {
        if (!previous.includes(userId) && userId !== tenant.userId) {
          await this.notifications.notify({
            organizationId: tenant.organizationId,
            userId,
            type: 'TASK_ASSIGNED',
            title: `${author?.name ?? 'Someone'} assigned you "${updated.title}"`,
            link: `/organizations/${tenant.organizationId}/projects/${updated.projectId}?task=${updated.id}`,
            actorId: tenant.userId,
          });
        }
      }
      for (const userId of previous) {
        if (!assigneeIds.includes(userId) && userId !== tenant.userId) {
          await this.notifications.notify({
            organizationId: tenant.organizationId,
            userId,
            type: 'TASK_UNASSIGNED',
            title: `You were unassigned from "${updated.title}"`,
            link: `/organizations/${tenant.organizationId}/projects/${updated.projectId}?task=${updated.id}`,
            actorId: tenant.userId,
          });
        }
      }
    }

    const dto = this.toDto(updated);
    this.realtime.emitToProject(updated.projectId, 'task.updated', {
      task: dto,
      actorId: tenant.userId,
    });
    return dto;
  }

  /**
   * Moves a task to another column and/or position.
   *
   * The new position is computed from the neighbouring tasks, so no other task is rewritten.
   */
  async move(
    tenant: TenantContext,
    taskId: string,
    input: { columnId: string; afterTaskId: string | null; version: number },
  ): Promise<TaskDto> {
    const current = await this.prisma.task.findFirst({
      where: { id: taskId, organizationId: tenant.organizationId },
      include: taskInclude,
    });
    if (!current) {
      throw AppException.notFound('task');
    }
    if (current.version !== input.version) {
      throw AppException.conflict(
        'conflict',
        'This task was changed by somebody else. Reload to see the latest version.',
        { current: this.toDto(current) },
      );
    }
    await this.assertColumn(tenant, input.columnId);

    const position = await this.nextPosition(tenant, input.columnId, input.afterTaskId, taskId);

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: { columnId: input.columnId, position, version: { increment: 1 } },
      include: taskInclude,
    });

    const author = await this.prisma.user.findUnique({
      where: { id: tenant.userId },
      select: { name: true },
    });

    await this.activity.record({
      organizationId: tenant.organizationId,
      actorId: tenant.userId,
      type: 'TASK_MOVED',
      summary: `${author?.name ?? 'Someone'} moved "${updated.title}"`,
      projectId: updated.projectId,
      taskId: updated.id,
      payload: { columnId: updated.columnId },
    });

    const dto = this.toDto(updated);
    this.realtime.emitToProject(updated.projectId, 'task.moved', {
      taskId: updated.id,
      boardId: updated.boardId,
      columnId: updated.columnId,
      task: dto,
      actorId: tenant.userId,
    });
    return dto;
  }

  async remove(tenant: TenantContext, taskId: string): Promise<void> {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, organizationId: tenant.organizationId },
    });
    if (!task) {
      throw AppException.notFound('task');
    }
    await this.prisma.task.delete({ where: { id: task.id } });
    await this.activity.record({
      organizationId: tenant.organizationId,
      actorId: tenant.userId,
      type: 'TASK_DELETED',
      summary: 'A task was deleted',
      projectId: task.projectId,
      payload: { title: task.title },
    });
    this.realtime.emitToProject(task.projectId, 'task.deleted', {
      taskId: task.id,
      actorId: tenant.userId,
    });
  }

  /**
   * Computes the position for a task that is inserted after `afterTaskId`.
   *
   * Only the moved task is written. The rare case where the gap between two neighbours is
   * exhausted rebalances that single column before the position is computed.
   */
  private async nextPosition(
    tenant: TenantContext,
    columnId: string,
    afterTaskId: string | null | undefined,
    excludeTaskId?: string,
  ): Promise<bigint> {
    let tasks = await this.columnTasks(tenant, columnId, excludeTaskId);
    let neighbours = this.neighbours(tasks, afterTaskId);
    let result = positionBetween(neighbours);

    if (result.kind === 'rebalance') {
      await this.rebalanceColumn(tasks);
      tasks = await this.columnTasks(tenant, columnId, excludeTaskId);
      neighbours = this.neighbours(tasks, afterTaskId);
      result = positionBetween(neighbours);
    }

    if (result.kind === 'rebalance') {
      // Should not happen after a rebalance; fall back to the end of the column.
      const last = tasks[tasks.length - 1]?.position ?? null;
      const fallback = positionAtEnd(last);
      if (fallback.kind === 'position') {
        return fallback.position;
      }
      throw AppException.internal('The position of the task could not be computed.');
    }

    return result.position;
  }

  private columnTasks(tenant: TenantContext, columnId: string, excludeTaskId?: string) {
    return this.prisma.task.findMany({
      where: {
        organizationId: tenant.organizationId,
        columnId,
        ...(excludeTaskId ? { id: { not: excludeTaskId } } : {}),
      },
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
      select: { id: true, position: true },
    });
  }

  /**
   * `undefined` appends at the end of the column, `null` moves the task to the top and an id
   * inserts the task right after that task.
   */
  private neighbours(
    tasks: Array<{ id: string; position: bigint }>,
    afterTaskId: string | null | undefined,
  ): { before: bigint | null; after: bigint | null } {
    if (afterTaskId === undefined) {
      return { before: tasks[tasks.length - 1]?.position ?? null, after: null };
    }
    if (afterTaskId === null) {
      return { before: null, after: tasks[0]?.position ?? null };
    }
    const index = tasks.findIndex((task) => task.id === afterTaskId);
    if (index === -1) {
      throw AppException.notFound('task');
    }
    return {
      before: tasks[index]!.position,
      after: tasks[index + 1]?.position ?? null,
    };
  }

  /** Spreads the tasks of a column evenly again; only used when a gap is exhausted. */
  private async rebalanceColumn(tasks: Array<{ id: string }>): Promise<void> {
    const positions = rebalancedPositions(tasks.length);
    for (const [index, task] of tasks.entries()) {
      await this.prisma.task.update({
        where: { id: task.id },
        data: { position: positions[index]! },
      });
    }
  }

  private async assertColumn(tenant: TenantContext, columnId: string): Promise<void> {
    const column = await this.prisma.column.findFirst({
      where: { id: columnId, organizationId: tenant.organizationId },
      select: { id: true },
    });
    if (!column) {
      throw AppException.notFound('column');
    }
  }

  private async assertMembers(tenant: TenantContext, userIds: string[]): Promise<string[]> {
    if (userIds.length === 0) {
      return [];
    }
    const memberships = await this.prisma.membership.findMany({
      where: { organizationId: tenant.organizationId, userId: { in: userIds } },
      select: { userId: true },
    });
    const allowed = new Set(memberships.map((membership) => membership.userId));
    const invalid = userIds.filter((userId) => !allowed.has(userId));
    if (invalid.length > 0) {
      throw AppException.badRequest(
        'invalid_assignee',
        'One or more assignees are not members of this organization.',
      );
    }
    return userIds;
  }

  private async assertLabels(tenant: TenantContext, labelIds: string[]): Promise<string[]> {
    if (labelIds.length === 0) {
      return [];
    }
    const labels = await this.prisma.label.findMany({
      where: { organizationId: tenant.organizationId, id: { in: labelIds } },
      select: { id: true },
    });
    const allowed = new Set(labels.map((label) => label.id));
    const invalid = labelIds.filter((labelId) => !allowed.has(labelId));
    if (invalid.length > 0) {
      throw AppException.badRequest(
        'invalid_label',
        'One or more labels do not belong to this organization.',
      );
    }
    return labelIds;
  }

  private encodeCursor(payload: { position: string; id: string }): string {
    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  }

  private decodeCursor(cursor: string): { position: string; id: string } | null {
    try {
      const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
        position?: string;
        id?: string;
      };
      if (!parsed.position) {
        return null;
      }
      return { position: parsed.position, id: parsed.id ?? '' };
    } catch {
      return null;
    }
  }

  private toDto(task: {
    id: string;
    organizationId: string;
    projectId: string;
    boardId: string;
    columnId: string;
    number: number;
    title: string;
    description: string | null;
    status: 'OPEN' | 'DONE';
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    dueDate: Date | null;
    completedAt: Date | null;
    version: number;
    createdById: string;
    createdAt: Date;
    updatedAt: Date;
    assignees: Array<{ user: { id: string; name: string; email: string } }>;
    labels: Array<{
      label: { id: string; organizationId: string; name: string; color: string; createdAt: Date };
    }>;
  }): TaskDto {
    return {
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
    };
  }
}
