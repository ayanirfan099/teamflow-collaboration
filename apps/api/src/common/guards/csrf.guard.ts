import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { createHmac } from 'node:crypto';
import { APP_CONFIG, AppConfig } from '../../config/configuration';
import { safeEqual } from '../crypto/tokens';
import { AppException } from '../errors';
import { IS_PUBLIC_KEY } from '../decorators';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF protection for state changing requests.
 *
 * Two layers:
 * 1. Double submit — the `tf_csrf` cookie value must be echoed in the `x-csrf-token` header.
 * 2. Session binding — for authenticated requests the token must additionally equal
 *    `HMAC(serverSecret, sessionId)`, so a token minted for another session is rejected.
 *
 * Anonymous routes (sign-in, registration) rely on the double submit layer plus the
 * `SameSite` cookie attribute.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method)) {
      return true;
    }

    const isPublic =
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false;

    const cookieToken = request.cookies?.[this.config.cookie.csrfName];
    const headerToken = request.headers['x-csrf-token'];

    if (typeof cookieToken !== 'string' || typeof headerToken !== 'string') {
      throw AppException.forbidden('csrf_failed', 'Missing CSRF token.');
    }
    if (!safeEqual(cookieToken, headerToken)) {
      throw AppException.forbidden('csrf_failed', 'Invalid CSRF token.');
    }

    const sessionId = request.context?.session?.id;
    if (sessionId && !isPublic) {
      const expected = createHmac('sha256', this.config.session.secret)
        .update(sessionId)
        .digest('base64url');
      if (!safeEqual(expected, headerToken)) {
        throw AppException.forbidden('csrf_failed', 'Invalid CSRF token.');
      }
    }

    return true;
  }
}
