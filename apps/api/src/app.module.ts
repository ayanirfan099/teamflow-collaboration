import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { CommonModule } from './common/common.module';
import { AppExceptionFilter } from './common/filters/app-exception.filter';
import { CapabilityGuard } from './common/guards/capability.guard';
import { CsrfGuard } from './common/guards/csrf.guard';
import { OrganizationGuard } from './common/guards/organization.guard';
import { RateLimitGuard } from './common/guards/rate-limit.guard';
import { SessionGuard } from './common/guards/session.guard';
import { IdempotencyInterceptor } from './common/idempotency/idempotency.interceptor';
import { AccessLogMiddleware } from './common/middleware/access-log.middleware';
import { RequestContextMiddleware } from './common/middleware/request-context.middleware';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { CollaborationModule } from './modules/collaboration/collaboration.module';
import { DatabaseModule } from './modules/database/database.module';
import { DocsModule } from './modules/docs/docs.module';
import { HealthModule } from './modules/health/health.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { TasksModule } from './modules/tasks/tasks.module';

/**
 * The order of the guards matters:
 * 1. the session guard authenticates the request,
 * 2. the CSRF guard verifies the token against the session,
 * 3. the organization guard resolves the tenant,
 * 4. the capability guard checks the role,
 * 5. the rate limit guard throttles the caller.
 */
@Module({
  imports: [
    CommonModule,
    DatabaseModule,
    DocsModule,
    AuthModule,
    AuditModule,
    OrganizationsModule,
    HealthModule,
    RealtimeModule,
    CollaborationModule,
    ProjectsModule,
    TasksModule,
    AttachmentsModule,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
    { provide: APP_FILTER, useClass: AppExceptionFilter },
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: OrganizationGuard },
    { provide: APP_GUARD, useClass: CapabilityGuard },
    { provide: APP_GUARD, useClass: RateLimitGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('{*path}');
    consumer.apply(AccessLogMiddleware).forRoutes('{*path}');
  }
}
