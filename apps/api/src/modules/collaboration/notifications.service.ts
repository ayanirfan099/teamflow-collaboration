import { Injectable } from '@nestjs/common';
import { NotificationType, PrismaClient } from '@teamflow/database';
import { AppException } from '../../common/errors';
import { TenantContext } from '../../common/types';
import { RealtimeGateway } from '../realtime/realtime.gateway';

export interface NotificationInput {
  organizationId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
  actorId?: string | null;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly realtime: RealtimeGateway,
  ) {}

  /** Creates a notification and pushes it to the recipient's socket, if connected. */
  async notify(input: NotificationInput): Promise<void> {
    const notification = await this.prisma.notification.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        link: input.link ?? null,
        actorId: input.actorId ?? null,
      },
      include: { actor: { select: { name: true } } },
    });

    this.realtime.emitToUser(input.userId, 'notification.created', {
      notification: {
        id: notification.id,
        organizationId: notification.organizationId,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        link: notification.link,
        actorId: notification.actorId,
        actorName: notification.actor?.name ?? null,
        readAt: notification.readAt?.toISOString() ?? null,
        createdAt: notification.createdAt.toISOString(),
      },
    });
  }

  async list(
    tenant: TenantContext,
    userId: string,
    options: { unreadOnly: boolean; limit: number },
  ) {
    const notifications = await this.prisma.notification.findMany({
      where: {
        organizationId: tenant.organizationId,
        userId,
        ...(options.unreadOnly ? { readAt: null } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: options.limit + 1,
      include: { actor: { select: { name: true } } },
    });

    const hasMore = notifications.length > options.limit;
    const data = (hasMore ? notifications.slice(0, options.limit) : notifications).map(
      (notification) => ({
        id: notification.id,
        organizationId: notification.organizationId,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        link: notification.link,
        actorId: notification.actorId,
        actorName: notification.actor?.name ?? null,
        readAt: notification.readAt?.toISOString() ?? null,
        createdAt: notification.createdAt.toISOString(),
      }),
    );

    const unreadCount = await this.prisma.notification.count({
      where: { organizationId: tenant.organizationId, userId, readAt: null },
    });

    return { data, unreadCount, hasMore };
  }

  async markRead(
    tenant: TenantContext,
    userId: string,
    ids: string[] | undefined,
    all: boolean | undefined,
  ): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: {
        organizationId: tenant.organizationId,
        userId,
        readAt: null,
        ...(all || !ids || ids.length === 0 ? {} : { id: { in: ids } }),
      },
      data: { readAt: new Date() },
    });
    if (result.count === 0 && ids && ids.length > 0) {
      throw AppException.notFound('notification');
    }
    return result.count;
  }
}
