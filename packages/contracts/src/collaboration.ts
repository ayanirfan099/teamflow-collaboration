import { z } from 'zod';
import { idSchema, isoDateTimeSchema, limitSchema } from './common';

export const COMMENT_NOTIFICATION_TYPES = ['MENTION', 'COMMENT', 'TASK_ASSIGNED'] as const;

export const notificationSchema = z.object({
  id: idSchema,
  organizationId: idSchema,
  type: z.enum([
    'MENTION',
    'COMMENT',
    'TASK_ASSIGNED',
    'TASK_UNASSIGNED',
    'TASK_DUE',
    'INVITATION',
  ]),
  title: z.string(),
  body: z.string().nullable(),
  link: z.string().nullable(),
  actorId: idSchema.nullable(),
  actorName: z.string().nullable(),
  readAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
});

export const commentSchema = z.object({
  id: idSchema,
  organizationId: idSchema,
  taskId: idSchema,
  body: z.string(),
  authorId: idSchema,
  authorName: z.string(),
  authorEmail: z.string(),
  mentions: z.array(z.object({ id: idSchema, name: z.string(), email: z.string() })),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const activityEventSchema = z.object({
  id: idSchema,
  organizationId: idSchema,
  projectId: idSchema.nullable(),
  taskId: idSchema.nullable(),
  type: z.string(),
  actorId: idSchema,
  actorName: z.string(),
  summary: z.string(),
  payload: z.unknown().nullable(),
  createdAt: isoDateTimeSchema,
});

export const auditEventSchema = z.object({
  id: idSchema,
  organizationId: idSchema,
  actorId: idSchema.nullable(),
  action: z.string(),
  targetType: z.string(),
  targetId: z.string().nullable(),
  metadata: z.unknown().nullable(),
  ipAddress: z.string().nullable(),
  createdAt: isoDateTimeSchema,
});

export const createCommentRequestSchema = z.object({
  body: z.string().trim().min(1).max(10000),
});

export const updateCommentRequestSchema = z.object({
  body: z.string().trim().min(1).max(10000),
});

export const commentQuerySchema = z.object({
  limit: limitSchema.optional(),
});

export const activityQuerySchema = z.object({
  taskId: idSchema.optional(),
  limit: limitSchema.optional(),
  cursor: z.string().min(1).max(512).optional(),
});

export const notificationQuerySchema = z.object({
  unreadOnly: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((value) => value === true || value === 'true')
    .optional(),
  limit: limitSchema.optional(),
});

export const markNotificationsReadRequestSchema = z.object({
  ids: z.array(idSchema).max(100).optional(),
  all: z.boolean().optional(),
});

export const auditQuerySchema = z.object({
  action: z.string().trim().max(64).optional(),
  limit: limitSchema.optional(),
  cursor: z.string().min(1).max(512).optional(),
});

export type NotificationDto = z.infer<typeof notificationSchema>;
export type CommentDto = z.infer<typeof commentSchema>;
export type ActivityEventDto = z.infer<typeof activityEventSchema>;
export type AuditEventDto = z.infer<typeof auditEventSchema>;
export type CreateCommentRequest = z.infer<typeof createCommentRequestSchema>;
export type MarkNotificationsReadRequest = z.infer<typeof markNotificationsReadRequestSchema>;
