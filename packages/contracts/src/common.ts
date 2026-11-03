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

/**
 * A repeatable query parameter.
 *
 * A query string carries a list either as `?labelIds=a&labelIds=b` or as `?labelIds=a,b`.
 * Both forms are accepted and always produce an array.
 */
export function arrayParam<T extends z.ZodTypeAny>(item: T) {
  return z.preprocess((value) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    const entries = Array.isArray(value) ? value : String(value).split(',');
    return entries.map((entry) => String(entry).trim()).filter((entry) => entry.length > 0);
  }, z.array(item).optional());
}

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
  meta: z.record(z.string(), z.unknown()).optional(),
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
