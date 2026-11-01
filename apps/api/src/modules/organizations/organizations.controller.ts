import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  acceptInvitationRequestSchema,
  createInvitationRequestSchema,
  createOrganizationRequestSchema,
  invitationQuerySchema,
  updateMemberRoleRequestSchema,
  updateOrganizationRequestSchema,
} from '@teamflow/contracts';
import { CurrentUser, Public, RateLimit, RequireCapability, Tenant } from '../../common/decorators';
import { parse } from '../../common/validation/parse';
import { AuthenticatedUser, TenantContext } from '../../common/types';
import { OrganizationsService } from './organizations.service';

@Controller()
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get('organizations')
  async list(@CurrentUser() user: AuthenticatedUser) {
    return { data: await this.organizations.list(user.id) };
  }

  @Post('organizations')
  async create(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const input = parse(createOrganizationRequestSchema, body);
    return { data: await this.organizations.create(user.id, input.name) };
  }

  @Get('organizations/:organizationId')
  @RequireCapability('organization:read')
  async get(@Tenant() tenant: TenantContext) {
    return { data: await this.organizations.get(tenant) };
  }

  @Patch('organizations/:organizationId')
  @RequireCapability('organization:update')
  async update(@Tenant() tenant: TenantContext, @Body() body: unknown) {
    const input = parse(updateOrganizationRequestSchema, body);
    return { data: await this.organizations.update(tenant, input) };
  }

  @Get('organizations/:organizationId/members')
  @RequireCapability('member:read')
  async members(@Tenant() tenant: TenantContext) {
    return { data: await this.organizations.members(tenant) };
  }

  @Patch('organizations/:organizationId/members/:membershipId')
  @RequireCapability('member:update')
  async updateMember(
    @Tenant() tenant: TenantContext,
    @Param('membershipId') membershipId: string,
    @Body() body: unknown,
  ) {
    const input = parse(updateMemberRoleRequestSchema, body);
    return {
      data: await this.organizations.updateMemberRole(tenant, membershipId, input.role),
    };
  }

  @Delete('organizations/:organizationId/members/:membershipId')
  @RequireCapability('member:remove')
  async removeMember(@Tenant() tenant: TenantContext, @Param('membershipId') membershipId: string) {
    await this.organizations.removeMember(tenant, membershipId);
    return { data: { id: membershipId, deleted: true } };
  }

  @Get('organizations/:organizationId/invitations')
  @RequireCapability('member:read')
  async invitations(@Tenant() tenant: TenantContext, @Query() query: unknown) {
    const params = parse(invitationQuerySchema, query);
    return { data: await this.organizations.invitations(tenant, params.status) };
  }

  @Post('organizations/:organizationId/invitations')
  @RequireCapability('member:invite')
  @RateLimit({ limit: 20, windowSeconds: 60 * 60, scope: 'user' })
  async invite(@Tenant() tenant: TenantContext, @Body() body: unknown) {
    const input = parse(createInvitationRequestSchema, body);
    return { data: await this.organizations.invite(tenant, input) };
  }

  @Delete('organizations/:organizationId/invitations/:invitationId')
  @RequireCapability('member:invite')
  async revokeInvitation(
    @Tenant() tenant: TenantContext,
    @Param('invitationId') invitationId: string,
  ) {
    await this.organizations.revokeInvitation(tenant, invitationId);
    return { data: { id: invitationId, revoked: true } };
  }

  /** The details of an invitation. The token itself is never returned. */
  @Get('invitations/:token')
  @Public()
  async preview(@Param('token') token: string) {
    return { data: await this.organizations.previewInvitation(token) };
  }

  @Post('invitations/accept')
  @RateLimit({ limit: 20, windowSeconds: 60 * 60, scope: 'user' })
  async accept(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const input = parse(acceptInvitationRequestSchema, body);
    return {
      data: await this.organizations.acceptInvitation(user.id, user.email, input.token),
    };
  }
}
