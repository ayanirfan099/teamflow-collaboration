import { z } from 'zod';
import { idSchema, isoDateTimeSchema, limitSchema, slugSchema } from './common';

export const PROJECT_STATUSES = ['ACTIVE', 'ARCHIVED'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const projectSchema = z.object({
  id: idSchema,
  organizationId: idSchema,
  name: z.string(),
  key: z.string(),
  description: z.string().nullable(),
  status: z.enum(PROJECT_STATUSES),
  color: z.string().nullable(),
  createdById: idSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  boardCount: z.number().int().nonnegative().optional(),
  taskCount: z.number().int().nonnegative().optional(),
  completedTaskCount: z.number().int().nonnegative().optional(),
});

export const boardSchema = z.object({
  id: idSchema,
  organizationId: idSchema,
  projectId: idSchema,
  name: z.string(),
  description: z.string().nullable(),
  isDefault: z.boolean(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  columnCount: z.number().int().nonnegative().optional(),
  taskCount: z.number().int().nonnegative().optional(),
});

export const columnSchema = z.object({
  id: idSchema,
  organizationId: idSchema,
  boardId: idSchema,
  name: z.string(),
  position: z.number().int(),
  wipLimit: z.number().int().nullable(),
  isDoneColumn: z.boolean(),
  taskCount: z.number().int().nonnegative().optional(),
});

export const labelSchema = z.object({
  id: idSchema,
  organizationId: idSchema,
  name: z.string(),
  color: z.string(),
  createdAt: isoDateTimeSchema,
});

export const createProjectRequestSchema = z.object({
  name: z.string().trim().min(2).max(80),
  key: z
    .string()
    .trim()
    .toUpperCase()
    .min(2)
    .max(6)
    .regex(/^[A-Z0-9]+$/, 'Key must be 2-6 letters or digits'),
  description: z.string().trim().max(2000).optional(),
  color: z.string().trim().max(32).optional(),
  boardName: z.string().trim().min(1).max(80).optional(),
});

export const updateProjectRequestSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  color: z.string().trim().max(32).nullable().optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
});

export const createBoardRequestSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(1000).optional(),
  isDefault: z.boolean().optional(),
  columns: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        wipLimit: z.number().int().min(0).max(999).nullable().optional(),
        isDoneColumn: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(12)
    .optional(),
});

export const updateBoardRequestSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  isDefault: z.boolean().optional(),
});

export const createColumnRequestSchema = z.object({
  name: z.string().trim().min(1).max(80),
  wipLimit: z.number().int().min(0).max(999).nullable().optional(),
  isDoneColumn: z.boolean().optional(),
});

export const updateColumnRequestSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  wipLimit: z.number().int().min(0).max(999).nullable().optional(),
  isDoneColumn: z.boolean().optional(),
});

export const reorderColumnRequestSchema = z.object({
  columnIds: z.array(idSchema).min(1).max(50),
});

export const createLabelRequestSchema = z.object({
  name: z.string().trim().min(1).max(40),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a hex value such as #b24a2e'),
});

export const projectQuerySchema = z.object({
  status: z.enum(['ACTIVE', 'ARCHIVED', 'ALL']).default('ACTIVE'),
  limit: limitSchema.optional(),
});

export const boardQuerySchema = z.object({
  limit: limitSchema.optional(),
});

export const labelQuerySchema = z.object({
  limit: limitSchema.optional(),
});

export type ProjectDto = z.infer<typeof projectSchema>;
export type BoardDto = z.infer<typeof boardSchema>;
export type ColumnDto = z.infer<typeof columnSchema>;
export type LabelDto = z.infer<typeof labelSchema>;
export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>;
export type UpdateProjectRequest = z.infer<typeof updateProjectRequestSchema>;
export type CreateBoardRequest = z.infer<typeof createBoardRequestSchema>;
export type UpdateBoardRequest = z.infer<typeof updateBoardRequestSchema>;
export type CreateColumnRequest = z.infer<typeof createColumnRequestSchema>;
export type UpdateColumnRequest = z.infer<typeof updateColumnRequestSchema>;
export type ReorderColumnRequest = z.infer<typeof reorderColumnRequestSchema>;
export type CreateLabelRequest = z.infer<typeof createLabelRequestSchema>;

export { slugSchema };
