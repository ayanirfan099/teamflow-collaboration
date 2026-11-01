import { Controller, Get, Query } from '@nestjs/common';
import { auditQuerySchema } from '@teamflow/contracts';
import { RequireCapability, Tenant } from '../../common/decorators';
import { parse } from '../../common/validation/parse';
import { TenantContext } from '../../common/types';
import { AuditService } from './audit.service';

@Controller('organizations/:organizationId')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  /** The audit log is only visible to owners and admins. */
  @Get('audit')
  @RequireCapability('audit:read')
  async list(@Tenant() tenant: TenantContext, @Query() query: unknown) {
    const params = parse(auditQuerySchema, query);
    const result = await this.audit.list(tenant.organizationId, {
      action: params.action,
      limit: params.limit ?? 50,
      cursor: params.cursor ?? null,
    });
    return { data: result.data, meta: { limit: params.limit ?? 50, hasMore: result.hasMore } };
  }
}
