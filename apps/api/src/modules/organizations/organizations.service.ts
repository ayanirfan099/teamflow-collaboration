import { Injectable } from '@nestjs/common';
import { MemberRole } from '@teamflow/contracts';
import { PrismaClient } from '@teamflow/database';
import { AppException } from '../../common/errors';
import { TenantContext } from '../../common/types';
import { hashToken, randomToken } from '../../common/crypto/tokens';
import { uniqueSlug } from '../../common/utils/slug';
import { AuditService } from '../audit/audit.service';

export interface InvitationResult {
  id: string;
  organizationId: string;
  email: string;
  role: MemberRole;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'REVOKED';
  invitedBy: { id: string; name: string; email: string } | null;
  expiresAt: string;
  createdAt: string;
  acceptedAt: string | null;
}

const INVITATION_TTL_HOURS = 72;

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly audit: AuditService,
  ) {}

  async list(userId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      include: {
        organization: {
          include: { _count: { select: { memberships: true } } },
        },
      },
    });

    return memberships.map((membership) => ({
      id: membership.organization.id,
      name: membership.organization.name,
      slug: membership.organization.slug,
      createdAt: membership.organization.createdAt.toISOString(),
      updatedAt: membership.organization.updatedAt.toISOString(),
      memberCount: membership.organization._count.memberships,
      role: membership.role,
    }));
  }

  async create(userId: string, name: string) {
    const slug = await uniqueSlug(name, async (candidate) => {
      const existing = await this.prisma.organization.findUnique({ where: { slug: candidate } });
      return existing !== null;
    });

    const organization = await this.prisma.$transaction(async (tx) => {
      const created = await tx.organization.create({ data: { name: name.trim(), slug } });
      await tx.membership.create({
        data: { organizationId: created.id, userId, role: 'OWNER' },
      });
      return created;
    });

    await this.audit.record({
      organizationId: organization.id,
      actorId: userId,
      action: 'ORGANIZATION_CREATED',
      targetType: 'organization',
      targetId: organization.id,
      metadata: { name: organization.name },
    });

    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      createdAt: organization.createdAt.toISOString(),
      updatedAt: organization.updatedAt.toISOString(),
    };
  }

  async get(tenant: TenantContext) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: tenant.organizationId },
      include: { _count: { select: { memberships: true } } },
    });
    if (!organization) {
      throw AppException.notFound('organization');
    }
    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      createdAt: organization.createdAt.toISOString(),
      updatedAt: organization.updatedAt.toISOString(),
      memberCount: organization._count.memberships,
      role: tenant.role,
    };
  }

  async update(tenant: TenantContext, input: { name?: string }) {
    if (input.name === undefined) {
      return this.get(tenant);
    }
    await this.prisma.organization.update({
      where: { id: tenant.organizationId },
      data: { name: input.name.trim() },
    });
    await this.audit.record({
      organizationId: tenant.organizationId,
      actorId: tenant.userId,
      action: 'ORGANIZATION_UPDATED',
      targetType: 'organization',
      targetId: tenant.organizationId,
      metadata: input,
    });
    return this.get(tenant);
  }

  async members(tenant: TenantContext) {
    const memberships = await this.prisma.membership.findMany({
      where: { organizationId: tenant.organizationId },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    const openTasks = await this.prisma.taskAssignee.groupBy({
      by: ['userId'],
      where: {
        organizationId: tenant.organizationId,
        task: { status: 'OPEN' },
      },
      _count: { _all: true },
    });
    const openTaskCounts = new Map(openTasks.map((entry) => [entry.userId, entry._count._all]));

    return memberships.map((membership) => ({
      id: membership.id,
      userId: membership.user.id,
      email: membership.user.email,
      name: membership.user.name,
      role: membership.role,
      joinedAt: membership.createdAt.toISOString(),
      openTaskCount: openTaskCounts.get(membership.user.id) ?? 0,
    }));
  }

  async updateMemberRole(tenant: TenantContext, membershipId: string, role: MemberRole) {
    if (role === 'OWNER') {
      throw AppException.badRequest(
        'invalid_role_change',
        'The owner role cannot be assigned. Ownership is transferred by another mechanism.',
      );
    }

    const membership = await this.prisma.membership.findFirst({
      where: { id: membershipId, organizationId: tenant.organizationId },
    });
    if (!membership) {
      throw AppException.notFound('member');
    }
    if (membership.userId === tenant.userId) {
      throw AppException.badRequest('cannot_remove_self', 'You cannot change your own role.');
    }
    if (membership.role === 'OWNER') {
      throw AppException.forbidden('forbidden', 'The role of an owner cannot be changed.');
    }

    const updated = await this.prisma.membership.update({
      where: { id: membership.id },
      data: { role },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    await this.audit.record({
      organizationId: tenant.organizationId,
      actorId: tenant.userId,
      action: 'MEMBER_ROLE_CHANGED',
      targetType: 'membership',
      targetId: membership.id,
      metadata: { role },
    });

    return {
      id: updated.id,
      userId: updated.user.id,
      email: updated.user.email,
      name: updated.user.name,
      role: updated.role,
      joinedAt: updated.createdAt.toISOString(),
    };
  }

  async removeMember(tenant: TenantContext, membershipId: string): Promise<void> {
    const membership = await this.prisma.membership.findFirst({
      where: { id: membershipId, organizationId: tenant.organizationId },
    });
    if (!membership) {
      throw AppException.notFound('member');
    }
    if (membership.userId === tenant.userId) {
      throw AppException.badRequest('cannot_remove_self', 'You cannot remove yourself.');
    }
    if (membership.role === 'OWNER') {
      const owners = await this.prisma.membership.count({
        where: { organizationId: tenant.organizationId, role: 'OWNER' },
      });
      if (owners <= 1) {
        throw AppException.badRequest('last_owner', 'The last owner cannot be removed.');
      }
    }

    await this.prisma.membership.delete({ where: { id: membership.id } });
    await this.audit.record({
      organizationId: tenant.organizationId,
      actorId: tenant.userId,
      action: 'MEMBER_REMOVED',
      targetType: 'membership',
      targetId: membership.id,
    });
  }

  async invite(
    tenant: TenantContext,
    input: { email: string; role: MemberRole },
  ): Promise<InvitationResult & { acceptUrl: string }> {
    const email = input.email.trim().toLowerCase();

    const existingMember = await this.prisma.membership.findFirst({
      where: { organizationId: tenant.organizationId, user: { email } },
      include: { user: { select: { email: true } } },
    });
    if (existingMember) {
      throw AppException.conflict('duplicate', 'This person is already a member.');
    }

    const pending = await this.prisma.invitation.findFirst({
      where: { organizationId: tenant.organizationId, email, acceptedAt: null, revokedAt: null },
    });
    if (pending && pending.expiresAt.getTime() > Date.now()) {
      throw AppException.conflict('duplicate', 'An invitation for this address is still open.');
    }

    const token = randomToken(32);
    const expiresAt = new Date(Date.now() + INVITATION_TTL_HOURS * 60 * 60 * 1000);

    const invitation = await this.prisma.invitation.create({
      data: {
        organizationId: tenant.organizationId,
        email,
        role: input.role,
        tokenHash: hashToken(token),
        invitedById: tenant.userId,
        expiresAt,
      },
      include: { invitedBy: { select: { id: true, name: true, email: true } } },
    });

    await this.audit.record({
      organizationId: tenant.organizationId,
      actorId: tenant.userId,
      action: 'MEMBER_INVITED',
      targetType: 'invitation',
      targetId: invitation.id,
      metadata: { email, role: input.role },
    });

    return {
      ...this.toInvitation(invitation),
      acceptUrl: `/invite/${token}`,
    };
  }

  async invitations(tenant: TenantContext, status: string) {
    const invitations = await this.prisma.invitation.findMany({
      where: {
        organizationId: tenant.organizationId,
        ...(status === 'ALL' ? {} : { status: status as InvitationResult['status'] }),
      },
      orderBy: { createdAt: 'desc' },
      include: { invitedBy: { select: { id: true, name: true, email: true } } },
    });
    return invitations.map((invitation) => this.toInvitation(invitation));
  }

  async revokeInvitation(tenant: TenantContext, invitationId: string): Promise<void> {
    const invitation = await this.prisma.invitation.findFirst({
      where: { id: invitationId, organizationId: tenant.organizationId },
    });
    if (!invitation) {
      throw AppException.notFound('invitation');
    }
    await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: { revokedAt: new Date() },
    });
    await this.audit.record({
      organizationId: tenant.organizationId,
      actorId: tenant.userId,
      action: 'INVITATION_REVOKED',
      targetType: 'invitation',
      targetId: invitation.id,
    });
  }

  /** Shows who an invitation belongs to, without exposing the token. */
  async previewInvitation(token: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash: hashToken(token) },
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        invitedBy: { select: { id: true, name: true, email: true } },
      },
    });
    if (!invitation) {
      throw AppException.notFound('invitation');
    }
    return {
      organizationId: invitation.organization.id,
      organizationName: invitation.organization.name,
      email: invitation.email,
      role: invitation.role,
      status: this.statusOf(invitation),
      expiresAt: invitation.expiresAt.toISOString(),
      invitedBy: invitation.invitedBy,
    };
  }

  /**
   * Accepts an invitation.
   *
   * The invitation is single use, expires after 72 hours and only works for the address it was
   * sent to.
   */
  async acceptInvitation(userId: string, userEmail: string, token: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { organization: { select: { id: true, name: true } } },
    });
    if (!invitation) {
      throw AppException.notFound('invitation');
    }
    if (invitation.revokedAt) {
      throw AppException.unprocessable('invitation_already_used', 'The invitation was revoked.');
    }
    if (invitation.acceptedAt) {
      throw AppException.unprocessable(
        'invitation_already_used',
        'The invitation was already used.',
      );
    }
    if (invitation.expiresAt.getTime() <= Date.now()) {
      throw AppException.unprocessable('invitation_expired', 'The invitation has expired.');
    }
    if (invitation.email.toLowerCase() !== userEmail.toLowerCase()) {
      throw AppException.forbidden(
        'forbidden',
        'This invitation was sent to a different email address.',
      );
    }

    const membership = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.membership.findFirst({
        where: { organizationId: invitation.organizationId, userId },
      });
      if (existing) {
        return existing;
      }
      const created = await tx.membership.create({
        data: {
          organizationId: invitation.organizationId,
          userId,
          role: invitation.role,
        },
      });
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });
      return created;
    });

    await this.audit.record({
      organizationId: invitation.organizationId,
      actorId: userId,
      action: 'INVITATION_ACCEPTED',
      targetType: 'invitation',
      targetId: invitation.id,
    });
    await this.audit.record({
      organizationId: invitation.organizationId,
      actorId: userId,
      action: 'MEMBER_JOINED',
      targetType: 'membership',
      targetId: membership.id,
      metadata: { email: userEmail },
    });

    return {
      organizationId: invitation.organization.id,
      organizationName: invitation.organization.name,
      role: membership.role,
    };
  }

  private statusOf(invitation: {
    acceptedAt: Date | null;
    revokedAt: Date | null;
    expiresAt: Date;
  }): InvitationResult['status'] {
    if (invitation.acceptedAt) {
      return 'ACCEPTED';
    }
    if (invitation.revokedAt) {
      return 'REVOKED';
    }
    if (invitation.expiresAt.getTime() <= Date.now()) {
      return 'EXPIRED';
    }
    return 'PENDING';
  }

  private toInvitation(invitation: {
    id: string;
    organizationId: string;
    email: string;
    role: MemberRole;
    acceptedAt: Date | null;
    revokedAt: Date | null;
    expiresAt: Date;
    createdAt: Date;
    invitedBy: { id: string; name: string; email: string } | null;
  }): InvitationResult {
    return {
      id: invitation.id,
      organizationId: invitation.organizationId,
      email: invitation.email,
      role: invitation.role,
      status: this.statusOf(invitation),
      invitedBy: invitation.invitedBy,
      expiresAt: invitation.expiresAt.toISOString(),
      createdAt: invitation.createdAt.toISOString(),
      acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
    };
  }
}
