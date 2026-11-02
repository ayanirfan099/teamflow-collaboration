import { Injectable } from '@nestjs/common';
import { parseMentions, renderMentionMarkup, resolveMentionUserIds } from '@teamflow/contracts';
import { PrismaClient } from '@teamflow/database';
import { AppException } from '../../common/errors';
import { TenantContext } from '../../common/types';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { ActivityService } from './activity.service';
import { NotificationsService } from './notifications.service';

export interface CommentDto {
  id: string;
  organizationId: string;
  taskId: string;
  body: string;
  authorId: string;
  authorName: string;
  authorEmail: string;
  mentions: Array<{ id: string; name: string; email: string }>;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly activity: ActivityService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async list(tenant: TenantContext, taskId: string, limit: number): Promise<CommentDto[]> {
    await this.assertTask(tenant, taskId);
    const comments = await this.prisma.comment.findMany({
      where: { organizationId: tenant.organizationId, taskId, deletedAt: null },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: limit,
      include: {
        author: { select: { id: true, name: true, email: true } },
        mentions: { include: { user: { select: { id: true, name: true, email: true } } } },
      },
    });

    return comments.map((comment) => ({
      id: comment.id,
      organizationId: comment.organizationId,
      taskId: comment.taskId,
      body: renderMentionMarkup(comment.body),
      authorId: comment.authorId,
      authorName: comment.author.name,
      authorEmail: comment.author.email,
      mentions: comment.mentions.map((mention) => ({
        id: mention.user.id,
        name: mention.user.name,
        email: mention.user.email,
      })),
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
    }));
  }

  async create(tenant: TenantContext, taskId: string, body: string): Promise<CommentDto> {
    const task = await this.assertTask(tenant, taskId);

    const members = await this.prisma.membership.findMany({
      where: { organizationId: tenant.organizationId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    const memberList = members.map((membership) => membership.user);

    const mentions = parseMentions(body);
    const mentionedUserIds = resolveMentionUserIds(mentions, memberList).filter(
      (userId) => userId !== tenant.userId,
    );

    const comment = await this.prisma.comment.create({
      data: {
        organizationId: tenant.organizationId,
        taskId,
        authorId: tenant.userId,
        body,
        mentions: {
          create: mentionedUserIds.map((userId) => ({
            organizationId: tenant.organizationId,
            userId,
          })),
        },
      },
      include: {
        author: { select: { id: true, name: true, email: true } },
        mentions: { include: { user: { select: { id: true, name: true, email: true } } } },
      },
    });

    const author = await this.prisma.user.findUnique({
      where: { id: tenant.userId },
      select: { name: true },
    });

    await this.activity.record({
      organizationId: tenant.organizationId,
      actorId: tenant.userId,
      type: 'COMMENT_CREATED',
      summary: `${author?.name ?? 'Someone'} commented on "${task.title}"`,
      projectId: task.projectId,
      taskId,
      payload: { commentId: comment.id },
    });

    for (const userId of mentionedUserIds) {
      await this.notifications.notify({
        organizationId: tenant.organizationId,
        userId,
        type: 'MENTION',
        title: `${author?.name ?? 'Someone'} mentioned you`,
        body: renderMentionMarkup(body).slice(0, 180),
        link: `/organizations/${tenant.organizationId}/projects/${task.projectId}?task=${taskId}`,
        actorId: tenant.userId,
      });
    }

    const dto: CommentDto = {
      id: comment.id,
      organizationId: comment.organizationId,
      taskId: comment.taskId,
      body: renderMentionMarkup(comment.body),
      authorId: comment.authorId,
      authorName: comment.author.name,
      authorEmail: comment.author.email,
      mentions: comment.mentions.map((mention) => ({
        id: mention.user.id,
        name: mention.user.name,
        email: mention.user.email,
      })),
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
    };

    this.realtime.emitToTask(taskId, 'comment.created', { comment: dto, actorId: tenant.userId });
    this.realtime.emitToOrganization(tenant.organizationId, 'comment.created', {
      comment: dto,
      actorId: tenant.userId,
    });

    return dto;
  }

  /**
   * Edits a comment.
   *
   * Only the author may edit their own comment; owners and admins may edit every comment of
   * their organization. The mentions are resolved again, so a mention that was added by the
   * edit notifies its recipient.
   */
  async update(tenant: TenantContext, commentId: string, body: string): Promise<CommentDto> {
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, organizationId: tenant.organizationId, deletedAt: null },
      include: {
        task: { select: { id: true, title: true, projectId: true } },
        mentions: { select: { userId: true } },
      },
    });
    if (!comment) {
      throw AppException.notFound('comment');
    }
    if (comment.authorId !== tenant.userId && tenant.role !== 'OWNER' && tenant.role !== 'ADMIN') {
      throw AppException.forbidden('forbidden', 'You can only edit your own comments.');
    }

    const members = await this.prisma.membership.findMany({
      where: { organizationId: tenant.organizationId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    const memberList = members.map((membership) => membership.user);
    const mentions = parseMentions(body);
    const mentionedUserIds = resolveMentionUserIds(mentions, memberList).filter(
      (userId) => userId !== tenant.userId,
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.mention.deleteMany({ where: { commentId: comment.id } });
      if (mentionedUserIds.length > 0) {
        await tx.mention.createMany({
          data: mentionedUserIds.map((userId) => ({
            organizationId: tenant.organizationId,
            commentId: comment.id,
            userId,
          })),
        });
      }
      return tx.comment.update({
        where: { id: comment.id },
        data: { body },
        include: {
          author: { select: { id: true, name: true, email: true } },
          mentions: { include: { user: { select: { id: true, name: true, email: true } } } },
        },
      });
    });

    await this.activity.record({
      organizationId: tenant.organizationId,
      actorId: tenant.userId,
      type: 'COMMENT_UPDATED',
      summary: `A comment on "${comment.task.title}" was edited`,
      projectId: comment.task.projectId,
      taskId: comment.task.id,
      payload: { commentId: comment.id },
    });

    const author = await this.prisma.user.findUnique({
      where: { id: tenant.userId },
      select: { name: true },
    });

    const previouslyMentioned = new Set(comment.mentions.map((mention) => mention.userId));
    for (const userId of mentionedUserIds) {
      if (previouslyMentioned.has(userId)) {
        continue;
      }
      await this.notifications.notify({
        organizationId: tenant.organizationId,
        userId,
        type: 'MENTION',
        title: `${author?.name ?? 'Someone'} mentioned you`,
        body: renderMentionMarkup(body).slice(0, 180),
        link: `/organizations/${tenant.organizationId}/projects/${comment.task.projectId}?task=${comment.task.id}`,
        actorId: tenant.userId,
      });
    }

    const dto: CommentDto = {
      id: updated.id,
      organizationId: updated.organizationId,
      taskId: updated.taskId,
      body: renderMentionMarkup(updated.body),
      authorId: updated.authorId,
      authorName: updated.author.name,
      authorEmail: updated.author.email,
      mentions: updated.mentions.map((mention) => ({
        id: mention.user.id,
        name: mention.user.name,
        email: mention.user.email,
      })),
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };

    this.realtime.emitToTask(updated.taskId, 'comment.updated', {
      comment: dto,
      actorId: tenant.userId,
    });
    this.realtime.emitToOrganization(tenant.organizationId, 'comment.updated', {
      comment: dto,
      actorId: tenant.userId,
    });

    return dto;
  }

  async remove(tenant: TenantContext, commentId: string): Promise<void> {
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, organizationId: tenant.organizationId, deletedAt: null },
      include: { task: { select: { id: true, title: true, projectId: true } } },
    });
    if (!comment) {
      throw AppException.notFound('comment');
    }
    if (comment.authorId !== tenant.userId && tenant.role !== 'OWNER' && tenant.role !== 'ADMIN') {
      throw AppException.forbidden('forbidden', 'You can only delete your own comments.');
    }

    await this.prisma.comment.delete({ where: { id: comment.id } });
    await this.activity.record({
      organizationId: tenant.organizationId,
      actorId: tenant.userId,
      type: 'COMMENT_DELETED',
      summary: 'A comment was deleted',
      projectId: comment.task.projectId,
      taskId: comment.task.id,
      payload: { commentId: comment.id },
    });
  }

  private async assertTask(tenant: TenantContext, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, organizationId: tenant.organizationId },
      select: { id: true, title: true, projectId: true, boardId: true },
    });
    if (!task) {
      throw AppException.notFound('task');
    }
    return task;
  }
}
