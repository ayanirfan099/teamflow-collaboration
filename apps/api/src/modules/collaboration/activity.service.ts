import { Injectable } from '@nestjs/common';
import { ActivityType, PrismaClient } from '@teamflow/database';

export interface ActivityInput {
  organizationId: string;
  actorId: string;
  type: ActivityType;
  summary: string;
  projectId?: string | null;
  taskId?: string | null;
  payload?: Record<string, unknown> | null;
}

/**
 * The durable activity feed.
 *
 * Only committed, meaningful changes are recorded — presence and other ephemeral updates never
 * reach this table.
 */
@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaClient) {}

  async record(input: ActivityInput): Promise<void> {
    await this.prisma.activityEvent.create({
      data: {
        organizationId: input.organizationId,
        actorId: input.actorId,
        type: input.type,
        summary: input.summary,
        projectId: input.projectId ?? null,
        taskId: input.taskId ?? null,
        payload: (input.payload ?? null) as never,
      },
    });
  }
}
