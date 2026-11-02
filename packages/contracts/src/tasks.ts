import { z } from 'zod';
import { arrayParam, idSchema, isoDateTimeSchema, limitSchema } from './common';

export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_STATUSES = ['OPEN', 'DONE', 'ARCHIVED'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const taskAssigneeSchema = z.object({
  userId: idSchema,
  name: z.string(),
  email: z.string(),
});

export const taskLabelSchema = z.object({
  id: idSchema,
  organizationId: idSchema,
  name: z.string(),
  color: z.string(),
  createdAt: isoDateTimeSchema,
});

export const taskSchema = z.object({
  id: idSchema,
  organizationId: idSchema,
  projectId: idSchema,
  boardId: idSchema,
  columnId: idSchema,
  number: z.number().int(),
  title: z.string(),
  description: z.string().nullable(),
  status: z.enum(TASK_STATUSES),
  priority: z.enum(TASK_PRIORITIES),
  dueDate: isoDateTimeSchema.nullable(),
  completedAt: isoDateTimeSchema.nullable(),
  assignees: z.array(taskAssigneeSchema),
  labels: z.array(taskLabelSchema),
  createdById: idSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  version: z.number().int(),
});

export const createTaskRequestSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(10000).optional(),
  boardId: idSchema,
  columnId: idSchema,
  priority: z.enum(TASK_PRIORITIES).optional(),
  dueDate: isoDateTimeSchema.nullish(),
  assigneeIds: z.array(idSchema).max(20).optional(),
  labelIds: z.array(idSchema).max(20).optional(),
  afterTaskId: idSchema.nullish(),
});

export const updateTaskRequestSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(10000).nullable().optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  dueDate: isoDateTimeSchema.nullish(),
  status: z.enum(TASK_STATUSES).optional(),
  columnId: idSchema.optional(),
  assigneeIds: z.array(idSchema).max(20).optional(),
  labelIds: z.array(idSchema).max(20).optional(),
  version: z.number().int().min(0),
});

export const moveTaskRequestSchema = z.object({
  columnId: idSchema,
  afterTaskId: idSchema.nullable(),
  version: z.number().int().min(0),
});

export const taskQuerySchema = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  boardId: idSchema.optional(),
  projectId: idSchema.optional(),
  columnId: idSchema.optional(),
  assigneeId: idSchema.optional(),
  labelIds: arrayParam(idSchema).transform((value) => value?.slice(0, 20)),
  priority: arrayParam(z.enum(TASK_PRIORITIES)).transform((value) => value?.slice(0, 4)),
  due: z.enum(['overdue', 'today', 'week', 'none']).optional(),
  status: z.enum(['open', 'done', 'archived', 'all']).default('open'),
  limit: limitSchema,
  cursor: z.string().min(1).max(512).optional(),
});

export const taskListResponseSchema = z.object({
  data: z.array(taskSchema),
  meta: z.object({
    limit: z.number().int(),
    hasMore: z.boolean(),
    nextCursor: z.string().nullable(),
  }),
});

export type TaskDto = z.infer<typeof taskSchema>;
export type CreateTaskRequest = z.infer<typeof createTaskRequestSchema>;
export type UpdateTaskRequest = z.infer<typeof updateTaskRequestSchema>;
export type MoveTaskRequest = z.infer<typeof moveTaskRequestSchema>;
export type TaskQuery = z.infer<typeof taskQuerySchema>;
