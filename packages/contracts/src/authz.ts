import { z } from 'zod';

export const MEMBER_ROLES = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const memberRoleSchema = z.enum(MEMBER_ROLES);

/**
 * Capabilities are the only thing the API authorises. Roles map onto capabilities in one
 * place (see `docs/api-conventions.md`), so a new role never changes a controller.
 */
export const CAPABILITIES = [
  'organization:read',
  'organization:update',
  'organization:delete',
  'member:read',
  'member:invite',
  'member:update',
  'member:remove',
  'project:read',
  'project:create',
  'project:update',
  'project:delete',
  'board:read',
  'board:write',
  'column:write',
  'task:read',
  'task:create',
  'task:update',
  'task:delete',
  'comment:read',
  'comment:create',
  'comment:update',
  'comment:delete',
  'notification:read',
  'audit:read',
  'attachment:read',
  'attachment:write',
] as const;

export type Capability = (typeof CAPABILITIES)[number];

export const ROLE_CAPABILITIES: Record<MemberRole, readonly Capability[]> = {
  OWNER: CAPABILITIES,
  ADMIN: CAPABILITIES.filter((capability) => capability !== 'organization:delete'),
  MEMBER: [
    'organization:read',
    'member:read',
    'project:read',
    'project:create',
    'project:update',
    'board:read',
    'board:write',
    'column:write',
    'task:read',
    'task:create',
    'task:update',
    'comment:read',
    'comment:create',
    'comment:update',
    'comment:delete',
    'notification:read',
    'attachment:read',
    'attachment:write',
  ],
  VIEWER: [
    'organization:read',
    'member:read',
    'project:read',
    'board:read',
    'task:read',
    'comment:read',
    'notification:read',
    'attachment:read',
  ],
};

export function can(role: MemberRole, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role].includes(capability);
}

export function roleLabel(role: MemberRole): string {
  return role.charAt(0) + role.slice(1).toLowerCase();
}
