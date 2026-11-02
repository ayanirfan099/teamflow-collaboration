'use client';

import { Button, EmptyState, useToast } from '@teamflow/ui';
import * as React from 'react';
import { ALLOWED_ATTACHMENT_TYPES, ATTACHMENT_MAX_BYTES } from '@teamflow/contracts';
import { useAttachments, useDeleteAttachment, useUploadAttachment } from '../lib/queries';
import { formatRelative } from '../lib/format';

export interface AttachmentsPanelProps {
  organizationId: string;
  taskId: string;
}

/** Human readable size of a file. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} kB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * The attachments of a task.
 *
 * The file is uploaded as `multipart/form-data` and downloaded through the API, which checks
 * the membership of the organization. The browser never renders the file inline.
 */
export function AttachmentsPanel({ organizationId, taskId }: AttachmentsPanelProps) {
  const { data, isLoading } = useAttachments(organizationId, taskId);
  const upload = useUploadAttachment(organizationId, taskId);
  const remove = useDeleteAttachment(organizationId);
  const { toast } = useToast();
  const inputRef = React.useRef<HTMLInputElement>(null);

  const attachments = data ?? [];

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) {
      return;
    }
    try {
      await upload.mutateAsync(file);
      toast({ title: 'File uploaded', tone: 'success' });
    } catch (error) {
      toast({
        title: 'The file could not be uploaded',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      });
    } finally {
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  }

  async function handleDelete(attachmentId: string, fileName: string) {
    try {
      await remove.mutateAsync(attachmentId);
      toast({ title: `${fileName} was removed.`, tone: 'success' });
    } catch (error) {
      toast({
        title: 'The file could not be removed',
        description: error instanceof Error ? error.message : undefined,
        tone: 'error',
      });
    }
  }

  return (
    <section aria-label="Attachments" className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-ink">
        Attachments <span className="text-ink-faint">({attachments.length})</span>
      </h3>

      {isLoading ? (
        <p className="text-sm text-ink-muted">Loading attachments…</p>
      ) : attachments.length === 0 ? (
        <EmptyState
          title="No attachments"
          description="Attach a file to share it with the team. Files are never rendered inline."
        />
      ) : (
        <ul className="flex flex-col gap-1.5">
          {attachments.map((attachment) => (
            <li
              key={attachment.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface-raised px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{attachment.fileName}</p>
                <p className="text-xs text-ink-faint">
                  {formatFileSize(attachment.size)} · {attachment.contentType} ·{' '}
                  {formatRelative(attachment.createdAt)}
                </p>
              </div>
              <a
                href={`/api/v1/organizations/${organizationId}/attachments/${attachment.id}/download`}
                className="rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-ink hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                download={attachment.fileName}
              >
                Download
              </a>
              <Button
                size="sm"
                variant="ghost"
                loading={remove.isPending && remove.variables === attachment.id}
                onClick={() => void handleDelete(attachment.id, attachment.fileName)}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="attachment-input" className="text-sm font-medium text-ink">
          Attach a file
        </label>
        <input
          ref={inputRef}
          id="attachment-input"
          type="file"
          className="text-sm text-ink-muted file:mr-3 file:rounded-lg file:border file:border-line file:bg-surface-raised file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink hover:file:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          accept={ALLOWED_ATTACHMENT_TYPES.join(',')}
          onChange={(event) => void handleFiles(event.target.files)}
          disabled={upload.isPending}
        />
        {upload.isPending ? <span className="text-xs text-ink-muted">Uploading…</span> : null}
      </div>
      <p className="text-xs text-ink-faint">
        Up to {formatFileSize(ATTACHMENT_MAX_BYTES)} per file. Allowed types:{' '}
        {ALLOWED_ATTACHMENT_TYPES.join(', ')}.
      </p>
    </section>
  );
}
