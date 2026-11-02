import { Global, Module } from '@nestjs/common';
import { APP_CONFIG } from '../config/configuration';
import { configuration } from '../config/configuration';
import { PolicyService } from './authz/policy.service';
import { CapabilityGuard } from './guards/capability.guard';
import { CsrfGuard } from './guards/csrf.guard';
import { OrganizationGuard } from './guards/organization.guard';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { SessionGuard } from './guards/session.guard';
import { IdempotencyInterceptor } from './idempotency/idempotency.interceptor';
import { IdempotencyService } from './idempotency/idempotency.service';
import { AccessLogMiddleware } from './middleware/access-log.middleware';
import { RequestContextMiddleware } from './middleware/request-context.middleware';
import { AppLogger } from './logging/app-logger';
import { RateLimitService } from './rate-limit/rate-limit.service';

/** Infrastructure that every module of the API needs. */
@Global()
@Module({
  providers: [
    { provide: APP_CONFIG, useFactory: () => configuration() },
    {
      provide: AppLogger,
      useFactory: (config: ReturnType<typeof configuration>) => new AppLogger(config),
      inject: [APP_CONFIG],
    },
    PolicyService,
    RateLimitService,
    IdempotencyService,
    SessionGuard,
    CsrfGuard,
    OrganizationGuard,
    CapabilityGuard,
    RateLimitGuard,
    RequestContextMiddleware,
    AccessLogMiddleware,
    IdempotencyInterceptor,
  ],
  exports: [
    APP_CONFIG,
    AppLogger,
    PolicyService,
    RateLimitService,
    IdempotencyService,
    SessionGuard,
    CsrfGuard,
    OrganizationGuard,
    CapabilityGuard,
    RateLimitGuard,
    RequestContextMiddleware,
    AccessLogMiddleware,
    IdempotencyInterceptor,
  ],
})
export class CommonModule {}
