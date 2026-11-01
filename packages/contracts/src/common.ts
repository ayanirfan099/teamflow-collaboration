import { z } from 'zod';

/** A UUID as it is stored in the database. */
export const idSchema = z.string().uuid();

/** A lowercase, URL safe identifier (organization and project slugs). */
export const slugSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase kebab-case');

export const isoDateTimeSchema = z.string().datetime({ offset: true });

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(254)
  .email('Enter a valid email address');

/** Page size. The API never returns more rows than the client asked for. */
export const limitSchema = z.coerce.number().int().min(1).max(100).default(25);

export const booleanish = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((value) => value === true || value === 'true' || value === '1');

export const cursorSchema = z.string().min(1).max(512).optional();

export const paginationQuerySchema = z.object({
  limit: limitSchema,
  cursor: cursorSchema,
});

export const successEnvelopeSchema = z.object({
  data: z.unknown(),
  meta: z.record(z.unknown()).optional(),
});

export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
  requestId: z.string().optional(),
});

export const errorEnvelopeSchema = z.object({
  error: apiErrorSchema,
});

export type SuccessEnvelope<T> = { data: T; meta?: Record<string, unknown> };
export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;
export type ApiErrorBody = z.infer<typeof apiErrorSchema>;
