import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaClient } from '@teamflow/database';
import type { Request } from 'express';
import { APP_CONFIG, AppConfig } from '../../config/configuration';
import { hashToken } from '../crypto/tokens';
import { AppException } from '../errors';
import { IS_PUBLIC_KEY } from '../decorators';

/**
 * Authenticates the request.
 *
 * The session cookie holds an opaque token; only its hash is stored. A revoked or expired
 * session is rejected with the same message as an unknown one.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaClient,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic =
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false;

    const request = context.switchToHttp().getRequest<Request>();
    const token = request.cookies?.[this.config.cookie.name];

    if (typeof token !== 'string' || token.length === 0) {
      if (isPublic) {
        return true;
      }
      throw AppException.unauthenticated();
    }

    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: { select: { id: true, email: true, name: true } } },
    });

    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      if (isPublic) {
        return true;
      }
      throw AppException.unauthenticated();
    }

    request.context = {
      ...(request.context ?? {}),
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
      },
      session: {
        id: session.id,
        userId: session.userId,
        expiresAt: session.expiresAt,
      },
    };

    // Touch the session so "last seen" stays meaningful.
    await this.prisma.session
      .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
      .catch(() => undefined);

    return true;
  }
}
