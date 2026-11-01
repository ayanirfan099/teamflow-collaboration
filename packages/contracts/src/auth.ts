import { z } from 'zod';
import { emailSchema, idSchema, isoDateTimeSchema, slugSchema } from './common';
import { MEMBER_ROLES } from './authz';

export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(200, 'Password must be at most 200 characters')
  .refine((value) => value.trim().length > 0, 'Password cannot be blank');

export const registerRequestSchema = z.object({
  email: emailSchema,
  name: z.string().trim().min(2).max(80),
  password: passwordSchema,
  organizationName: z.string().trim().min(2).max(80).optional(),
});

export const loginRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});

export const userSchema = z.object({
  id: idSchema,
  email: z.string(),
  name: z.string(),
  createdAt: isoDateTimeSchema,
});

export const membershipSchema = z.object({
  id: idSchema,
  organizationId: idSchema,
  organizationName: z.string(),
  organizationSlug: slugSchema,
  role: z.enum(MEMBER_ROLES),
  joinedAt: isoDateTimeSchema,
});

export const sessionSchema = z.object({
  id: idSchema,
  createdAt: isoDateTimeSchema,
  expiresAt: isoDateTimeSchema,
  lastSeenAt: isoDateTimeSchema,
  userAgent: z.string().nullable(),
});

export const meResponseSchema = z.object({
  user: userSchema,
  memberships: z.array(membershipSchema),
  activeSession: sessionSchema.optional(),
});

export const csrfResponseSchema = z.object({
  token: z.string(),
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type UserDto = z.infer<typeof userSchema>;
export type MembershipDto = z.infer<typeof membershipSchema>;
export type SessionDto = z.infer<typeof sessionSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;

export const organizationSchema = z.object({
  id: idSchema,
  name: z.string(),
  slug: slugSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  memberCount: z.number().int().nonnegative().optional(),
  role: z.enum(MEMBER_ROLES).optional(),
});

export const memberSchema = z.object({
  id: idSchema,
  userId: idSchema,
  email: z.string(),
  name: z.string(),
  role: z.enum(MEMBER_ROLES),
  joinedAt: isoDateTimeSchema,
  openTaskCount: z.number().int().nonnegative().optional(),
});

export const invitationSchema = z.object({
  id: idSchema,
  organizationId: idSchema,
  email: z.string(),
  role: z.enum(MEMBER_ROLES),
  status: z.enum(['PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'REVOKED']),
  invitedBy: z.object({ id: idSchema, name: z.string(), email: z.string() }).nullable(),
  expiresAt: isoDateTimeSchema,
  createdAt: isoDateTimeSchema,
  acceptedAt: isoDateTimeSchema.nullable(),
});

export const createOrganizationRequestSchema = z.object({
  name: z.string().trim().min(2).max(80),
});

export const updateOrganizationRequestSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
});

export const createInvitationRequestSchema = z.object({
  email: emailSchema,
  role: z.enum(MEMBER_ROLES).exclude(['OWNER']).default('MEMBER'),
});

export const updateMemberRoleRequestSchema = z.object({
  role: z.enum(MEMBER_ROLES),
});

export const acceptInvitationRequestSchema = z.object({
  token: z.string().min(10).max(200),
});

export const invitationQuerySchema = z.object({
  status: z
    .enum(['PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'REVOKED', 'ALL'])
    .default('PENDING'),
});

export type OrganizationDto = z.infer<typeof organizationSchema>;
export type MemberDto = z.infer<typeof memberSchema>;
export type InvitationDto = z.infer<typeof invitationSchema>;
export type CreateInvitationRequest = z.infer<typeof createInvitationRequestSchema>;
export type UpdateMemberRoleRequest = z.infer<typeof updateMemberRoleRequestSchema>;
export type AcceptInvitationRequest = z.infer<typeof acceptInvitationRequestSchema>;
