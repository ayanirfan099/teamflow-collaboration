import { Capability, MemberRole, ROLE_CAPABILITIES } from '@teamflow/contracts';
import { Injectable } from '@nestjs/common';

/**
 * The single place where a role is translated into a capability.
 *
 * Controllers ask for a capability (`@RequireCapability('task:create')`), never for a role, so
 * a new role can be introduced without touching a single controller.
 */
@Injectable()
export class PolicyService {
  can(role: MemberRole, capability: Capability): boolean {
    return ROLE_CAPABILITIES[role]?.includes(capability) ?? false;
  }

  capabilitiesOf(role: MemberRole): readonly Capability[] {
    return ROLE_CAPABILITIES[role] ?? [];
  }

  isAtLeast(role: MemberRole, minimum: MemberRole): boolean {
    const order: MemberRole[] = ['VIEWER', 'MEMBER', 'ADMIN', 'OWNER'];
    return order.indexOf(role) >= order.indexOf(minimum);
  }
}
