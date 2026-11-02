import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { AppException } from '../errors';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { RATE_LIMIT_KEY, RateLimitOptions } from '../decorators';

/** Applies the rate limit that is configured for a route. */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimit: RateLimitService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.getAllAndOverride<RateLimitOptions | RateLimitOptions[]>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!options) {
      return true;
    }

    const limits = Array.isArray(options) ? options : [options];
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    for (const limit of limits) {
      const key = this.keyFor(request, limit);
      const decision = this.rateLimit.check(key, limit.limit, limit.windowSeconds);

      response.setHeader('x-ratelimit-remaining', String(decision.remaining));
      if (!decision.allowed) {
        response.setHeader('retry-after', String(decision.retryAfterSeconds));
        throw AppException.tooManyRequests('Too many requests. Please try again later.');
      }
    }

    return true;
  }

  private keyFor(request: Request, limit: RateLimitOptions): string {
    const ip = request.ip ?? 'unknown';
    const userId = request.context?.user?.id;
    const email = (request.body as { email?: string } | undefined)?.email;

    switch (limit.scope) {
      case 'user':
        return `user:${userId ?? ip}`;
      case 'ip-and-email':
        return `ip-email:${ip}:${email?.toLowerCase() ?? 'none'}`;
      case 'ip':
      default:
        return `ip:${ip}`;
    }
  }
}
