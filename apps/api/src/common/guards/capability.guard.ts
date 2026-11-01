import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Capability } from '@teamflow/contracts';
import { PolicyService } from '../authz/policy.service';
import { AppException } from '../errors';
import { CAPABILITY_KEY } from '../decorators';

/** Checks whether the role of the current organization may use the route. */
@Injectable()
export class CapabilityGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly policy: PolicyService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const capability = this.reflector.getAllAndOverride<Capability>(CAPABILITY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!capability) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const tenant = request.context?.tenant;
    if (!tenant) {
      throw AppException.forbidden();
    }

    if (!this.policy.can(tenant.role, capability)) {
      throw AppException.forbidden();
    }

    return true;
  }
}
