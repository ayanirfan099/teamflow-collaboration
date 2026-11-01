import { Inject, Injectable } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { PrismaClient } from '@teamflow/database';
import { APP_CONFIG, AppConfig } from '../../config/configuration';
import { hashPassword, verifyPassword } from '../../common/crypto/password';
import { hashToken, randomToken } from '../../common/crypto/tokens';
import { AppException } from '../../common/errors';
import { AppLogger } from '../../common/logging/app-logger';
import { uniqueSlug } from '../../common/utils/slug';
import { AuditService } from '../audit/audit.service';

export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

export interface SessionTokens {
  sessionId: string;
  token: string;
  csrfToken: string;
  expiresAt: Date;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly audit: AuditService,
    private readonly logger: AppLogger,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** The CSRF token for an anonymous request. */
  anonymousCsrfToken(): string {
    return randomToken(24);
  }

  /** The CSRF token for a session: it is bound to the session id. */
  sessionCsrfToken(sessionId: string): string {
    return createHmac('sha256', this.config.session.secret).update(sessionId).digest('base64url');
  }

  async register(
    input: { email: string; name: string; password: string; organizationName?: string },
    meta: RequestMeta,
  ): Promise<{ userId: string; tokens: SessionTokens }> {
    const email = input.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      // The answer is the same for a taken address and for a weak password, so the endpoint
      // cannot be used to find registered addresses.
      throw AppException.conflict(
        'duplicate',
        'An account with this email address already exists.',
      );
    }

    const passwordHash = await hashPassword(input.password);
    const user = await this.prisma.user.create({
      data: { email, name: input.name.trim(), passwordHash },
    });

    if (input.organizationName) {
      const organization = await this.createOrganization(user.id, input.organizationName);
      await this.audit.record({
        organizationId: organization.id,
        actorId: user.id,
        action: 'ORGANIZATION_CREATED',
        targetType: 'organization',
        targetId: organization.id,
        metadata: { name: organization.name },
        ipAddress: meta.ipAddress,
      });
    }

    const tokens = await this.createSession(user.id, meta);
    await this.audit
      .record({
        organizationId: '',
        actorId: user.id,
        action: 'AUTH_LOGIN',
        targetType: 'session',
        targetId: tokens.sessionId,
        ipAddress: meta.ipAddress,
      })
      .catch(() => undefined);

    return { userId: user.id, tokens };
  }

  async login(
    input: { email: string; password: string },
    meta: RequestMeta,
  ): Promise<{ userId: string; tokens: SessionTokens }> {
    const email = input.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      // The same work is done for an unknown address, so the response time does not reveal
      // whether the address exists.
      await verifyPassword(input.password, 'scrypt$16384$8$1$AAAA$AAAA');
      throw AppException.invalidCredentials();
    }

    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) {
      throw AppException.invalidCredentials();
    }

    const tokens = await this.createSession(user.id, meta);
    await this.audit
      .record({
        organizationId: '',
        actorId: user.id,
        action: 'AUTH_LOGIN',
        targetType: 'session',
        targetId: tokens.sessionId,
        ipAddress: meta.ipAddress,
      })
      .catch(() => undefined);

    return { userId: user.id, tokens };
  }

  async logout(sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async logoutAll(userId: string): Promise<number> {
    const result = await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count;
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, createdAt: true },
    });
    if (!user) {
      throw AppException.unauthenticated();
    }

    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      include: { organization: { select: { id: true, name: true, slug: true } } },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt.toISOString(),
      },
      memberships: memberships.map((membership) => ({
        id: membership.id,
        organizationId: membership.organization.id,
        organizationName: membership.organization.name,
        organizationSlug: membership.organization.slug,
        role: membership.role,
        joinedAt: membership.createdAt.toISOString(),
      })),
    };
  }

  async sessions(userId: string) {
    const sessions = await this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        expiresAt: true,
        lastSeenAt: true,
        userAgent: true,
      },
    });
    return sessions.map((session) => ({
      id: session.id,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      lastSeenAt: session.lastSeenAt.toISOString(),
      userAgent: session.userAgent,
    }));
  }

  async createOrganization(userId: string, name: string) {
    const slug = await uniqueSlug(name, async (candidate) => {
      const existing = await this.prisma.organization.findUnique({ where: { slug: candidate } });
      return existing !== null;
    });

    return this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({ data: { name: name.trim(), slug } });
      await tx.membership.create({
        data: { organizationId: organization.id, userId, role: 'OWNER' },
      });
      return organization;
    });
  }

  private async createSession(userId: string, meta: RequestMeta): Promise<SessionTokens> {
    const token = randomToken(32);
    const expiresAt = new Date(Date.now() + this.config.session.ttlDays * 24 * 60 * 60 * 1000);

    const session = await this.prisma.session.create({
      data: {
        userId,
        tokenHash: hashToken(token),
        expiresAt,
        ipAddress: meta.ipAddress ?? null,
        userAgent: meta.userAgent ?? null,
      },
    });

    this.logger.debug('session created', { userId, sessionId: session.id });

    return {
      sessionId: session.id,
      token,
      csrfToken: this.sessionCsrfToken(session.id),
      expiresAt,
    };
  }
}
