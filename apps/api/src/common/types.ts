import { MemberRole } from '@teamflow/contracts';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
}

export interface SessionContext {
  id: string;
  userId: string;
  expiresAt: Date;
}

export interface TenantContext {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  role: MemberRole;
  userId: string;
  membershipId: string;
}

export interface RequestContext {
  requestId?: string;
  user?: AuthenticatedUser;
  session?: SessionContext;
  tenant?: TenantContext;
}

declare module 'express-serve-static-core' {
  interface Request {
    context?: RequestContext;
  }
}
