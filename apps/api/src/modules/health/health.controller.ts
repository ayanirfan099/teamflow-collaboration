import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /** Liveness: the process answers. */
  @Get('live')
  @Public()
  live() {
    return { data: { status: 'ok', uptime: process.uptime() } };
  }

  /** Readiness: the database is reachable. */
  @Get('ready')
  @Public()
  async ready() {
    const database = await this.health.checkDatabase();
    return {
      data: {
        status: database.ok ? 'ok' : 'degraded',
        checks: { database },
      },
    };
  }
}
