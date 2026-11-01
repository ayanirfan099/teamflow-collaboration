import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { PrismaClient } from '@teamflow/database';
import type { Request } from 'express';
import { AppException } from '../errors';

/**
 * Resolves the organization of the request.
 *
 * The organization id comes from the URL; the membership decides the role. A user without a
 * membership gets the same "not found" answer as a non-existing organization, so the
 * endpoint cannot be used to probe for organizations.
 */
@Injectable()
export class OrganizationGuard implements CanActivate {
  constructor(private readonly prisma: PrismaClient) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const rawOrganizationId = request.params?.organizationId;
    if (!rawOrganizationId) {
      return true;
    }
    const organizationId = Array.isArray(rawOrganizationId)
      ? rawOrganizationId[0]
      : rawOrganizationId;
    if (!organizationId) {
      return true;
    }

    const userId = request.context?.user?.id;
    if (!userId) {
      throw AppException.unauthenticated();
    }

    const membership = await this.prisma.membership.findFirst({
      where: { organizationId, userId },
      include: { organization: { select: { id: true, name: true, slug: true } } },
    });

    if (!membership) {
      throw AppException.notFound('organization');
    }

    request.context = {
      ...(request.context ?? {}),
      tenant: {
        organizationId: membership.organization.id,
        organizationName: membership.organization.name,
        organizationSlug: membership.organization.slug,
        role: membership.role,
        userId,
        membershipId: membership.id,
      },
    };

    return true;
  }
}
