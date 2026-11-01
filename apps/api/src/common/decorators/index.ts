import { Capability } from '@teamflow/contracts';
import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { AuthenticatedUser, TenantContext } from '../types';

export const IS_PUBLIC_KEY = 'teamflow:public';
export const CAPABILITY_KEY = 'teamflow:capability';
export const RATE_LIMIT_KEY = 'teamflow:rate-limit';
export const IDEMPOTENT_KEY = 'teamflow:idempotent';

/** Marks a route as reachable without a session. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Requires a capability for the role of the current organization. */
export const RequireCapability = (capability: Capability) =>
  SetMetadata(CAPABILITY_KEY, capability);

export interface RateLimitOptions {
  limit: number;
  windowSeconds: number;
  /** Buckets the limit per IP instead of per user. */
  scope?: 'ip' | 'user' | 'ip-and-email';
}

/** Limits how often a route can be called. */
export const RateLimit = (options: RateLimitOptions | RateLimitOptions[]) =>
  SetMetadata(RATE_LIMIT_KEY, options);

/** Marks a route as idempotent: the `idempotency-key` header makes retries safe. */
export const Idempotent = () => SetMetadata(IDEMPOTENT_KEY, true);

/** The authenticated user of the current request. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.context?.user;
    if (!user) {
      throw new Error('CurrentUser used on a route without a session');
    }
    return user;
  },
);

/** The organization of the current request. */
export const Tenant = createParamDecorator(
  (_data: unknown, context: ExecutionContext): TenantContext => {
    const request = context.switchToHttp().getRequest<Request>();
    const tenant = request.context?.tenant;
    if (!tenant) {
      throw new Error('Tenant used on a route without an organization');
    }
    return tenant;
  },
);
