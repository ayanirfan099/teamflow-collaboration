import { z } from 'zod';
import { idSchema, isoDateTimeSchema } from './common';

/**
 * Attachments are downloaded only, never rendered in the browser.
 *
 * The allowlist contains the file types a project team actually shares. Everything else is
 * rejected on the server, and the download always carries
 * `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff`.
 */
export const ALLOWED_ATTACHMENT_TYPES = [
  'application/pdf',
  'application/json',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/zip',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/csv',
  'text/markdown',
  'text/plain',
] as const;

export type AllowedAttachmentType = (typeof ALLOWED_ATTACHMENT_TYPES)[number];

/** The default upper bound of an upload (10 MiB). */
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

export const attachmentSchema = z.object({
  id: idSchema,
  organizationId: idSchema,
  taskId: idSchema.nullable(),
  commentId: idSchema.nullable(),
  fileName: z.string(),
  contentType: z.string(),
  size: z.number().int(),
  uploadedById: idSchema,
  createdAt: isoDateTimeSchema,
});

export const attachmentListResponseSchema = z.object({
  data: z.array(attachmentSchema),
  meta: z.object({
    limit: z.number().int(),
    hasMore: z.boolean(),
    nextCursor: z.string().nullable(),
  }),
});

export type AttachmentDto = z.infer<typeof attachmentSchema>;

/**
 * The sanitised name of an uploaded file.
 *
 * The original name is only ever metadata: it never becomes a path and never reaches the
 * storage layer.
 */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'file';
  const cleaned = base
    .normalize('NFKD')
    .replace(/[^\w.\- ]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length > 0 ? cleaned.slice(0, 180) : 'file';
}

/** Whether the content type may be uploaded. */
export function isAllowedContentType(contentType: string): boolean {
  return (ALLOWED_ATTACHMENT_TYPES as readonly string[]).includes(contentType.toLowerCase());
}
