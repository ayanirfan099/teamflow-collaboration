import type { ZodTypeAny, z } from 'zod';
import { AppException } from '../errors';

/**
 * Validates an input with a Zod schema.
 *
 * The parsed value is returned, so the controller always works with typed data. A validation
 * error becomes a `validation_failed` response with the list of issues.
 */
export function parse<T extends ZodTypeAny>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw AppException.validation('The request payload is invalid.', {
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }
  return result.data;
}
