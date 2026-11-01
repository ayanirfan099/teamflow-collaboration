import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@teamflow/database';
import { AppLogger } from '../../common/logging/app-logger';

export interface HealthCheck {
  ok: boolean;
  latencyMs: number;
  error?: string;
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: AppLogger,
  ) {}

  /** Checks that the database answers. The error message never contains SQL details. */
  async checkDatabase(): Promise<HealthCheck> {
    const startedAt = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true, latencyMs: Date.now() - startedAt };
    } catch (error) {
      this.logger.error('database health check failed', { error: String(error) });
      return {
        ok: false,
        latencyMs: Date.now() - startedAt,
        error: 'The database is not reachable.',
      };
    }
  }
}
