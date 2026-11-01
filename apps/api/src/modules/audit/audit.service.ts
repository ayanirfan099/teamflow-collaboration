import { Injectable } from '@nestjs/common';
import { AuditAction, PrismaClient } from '@teamflow/database';
import { AppLogger } from '../../common/logging/app-logger';

export interface AuditInput {
  organizationId: string;
  actorId?: string | null;
  action: AuditAction;
  targetType: string;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

/**
 * Writes the audit log.
 *
 * The audit log is append-only and belongs to an organization. Events without an
 * organization (for example a sign-in before the first membership exists) are skipped, so the
 * log never contains rows that point nowhere.
 */
@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: AppLogger,
  ) {}

  async record(input: AuditInput): Promise<void> {
    if (!input.organizationId) {
      return;
    }
    try {
      await this.prisma.auditEvent.create({
        data: {
          organizationId: input.organizationId,
          actorId: input.actorId ?? null,
          action: input.action,
          targetType: input.targetType,
          targetId: input.targetId ?? null,
          metadata: (input.metadata ?? null) as never,
          ipAddress: input.ipAddress ?? null,
        },
      });
    } catch (error) {
      // The audit log must never break the request it describes.
      this.logger.warn('could not write the audit event', {
        action: input.action,
        organizationId: input.organizationId,
      });
      void error;
    }
  }

  async list(
    organizationId: string,
    options: { action?: string; limit: number; cursor?: string | null },
  ) {
    const events = await this.prisma.auditEvent.findMany({
      where: {
        organizationId,
        ...(options.action ? { action: options.action as AuditAction } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: options.limit + 1,
      include: { actor: { select: { id: true, name: true, email: true } } },
    });

    const hasMore = events.length > options.limit;
    const rows = hasMore ? events.slice(0, options.limit) : events;

    return {
      data: rows.map((event) => ({
        id: event.id,
        organizationId: event.organizationId,
        actorId: event.actorId,
        actorName: event.actor?.name ?? null,
        action: event.action,
        targetType: event.targetType,
        targetId: event.targetId,
        metadata: (event.metadata as Record<string, unknown> | null) ?? null,
        ipAddress: event.ipAddress,
        createdAt: event.createdAt.toISOString(),
      })),
      hasMore,
    };
  }
}
