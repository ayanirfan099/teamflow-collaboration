import { Inject, Injectable } from '@nestjs/common';
import { PrismaClient } from '@teamflow/database';
import {
  ALLOWED_ATTACHMENT_TYPES,
  isAllowedContentType,
  sanitizeFileName,
} from '@teamflow/contracts';
import { APP_CONFIG, AppConfig } from '../../config/configuration';
import { AppException } from '../../common/errors';
import { TenantContext } from '../../common/types';
import { ActivityService } from '../collaboration/activity.service';
import { isContentTypeConsistent } from './mime';
import { buildStorageKey, STORAGE_DRIVER, type StorageDriver } from './storage';

export interface UploadedFile {
  originalName: string;
  contentType: string;
  buffer: Buffer;
  size: number;
}

export interface AttachmentDto {
  id: string;
  organizationId: string;
  taskId: string | null;
  commentId: string | null;
  fileName: string;
  contentType: string;
  size: number;
  uploadedById: string;
  createdAt: string;
}

/**
 * Attachments of a task.
 *
 * The rules are enforced on the server: the size limit, the content type allowlist and a
 * signature check. The file is stored under a random key; the original name is metadata only.
 */
@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly activity: ActivityService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async list(tenant: TenantContext, taskId: string): Promise<AttachmentDto[]> {
    await this.assertTask(tenant, taskId);

    const attachments = await this.prisma.attachment.findMany({
      where: { organizationId: tenant.organizationId, taskId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    return attachments.map((attachment) => this.toDto(attachment));
  }

  async upload(
    tenant: TenantContext,
    taskId: string,
    userId: string,
    file: UploadedFile,
  ): Promise<AttachmentDto> {
    const task = await this.assertTask(tenant, taskId);

    if (!file.buffer || file.buffer.length === 0) {
      throw AppException.validation('The file is empty.');
    }

    const maxBytes = this.config.storage.maxUploadBytes;
    if (file.buffer.length > maxBytes) {
      throw AppException.tooLarge(
        `The file is larger than the limit of ${Math.floor(maxBytes / (1024 * 1024))} MiB.`,
      );
    }

    const contentType = (file.contentType || 'application/octet-stream').toLowerCase();
    if (!isAllowedContentType(contentType)) {
      throw AppException.unsupportedMediaType(`The content type "${contentType}" is not allowed.`, {
        allowed: ALLOWED_ATTACHMENT_TYPES,
      });
    }

    if (!isContentTypeConsistent(file.buffer, contentType)) {
      throw AppException.unsupportedMediaType(
        'The content of the file does not match its content type.',
      );
    }

    const storageKey = buildStorageKey();
    await this.storage.put(storageKey, file.buffer, contentType);

    const fileName = sanitizeFileName(file.originalName);

    try {
      const attachment = await this.prisma.attachment.create({
        data: {
          organizationId: tenant.organizationId,
          taskId,
          commentId: null,
          fileName,
          contentType,
          size: file.buffer.length,
          storageKey,
          uploadedById: userId,
        },
      });

      await this.activity.record({
        organizationId: tenant.organizationId,
        actorId: userId,
        type: 'ATTACHMENT_ADDED',
        summary: `attached ${fileName}`,
        projectId: task.projectId,
        taskId,
        payload: { attachmentId: attachment.id, contentType, size: attachment.size },
      });

      return this.toDto(attachment);
    } catch (error) {
      // The database write failed — the orphaned object is removed again.
      await this.storage.delete(storageKey).catch(() => undefined);
      throw error;
    }
  }

  /** Loads an attachment of the tenant and opens its stream. */
  async open(
    tenant: TenantContext,
    attachmentId: string,
  ): Promise<{ attachment: AttachmentDto; stream: NodeJS.ReadableStream }> {
    const attachment = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, organizationId: tenant.organizationId },
    });

    if (!attachment) {
      throw AppException.notFound('attachment');
    }

    const object = await this.storage.get(attachment.storageKey);
    if (!object) {
      throw AppException.notFound('attachment');
    }

    return { attachment: this.toDto(attachment), stream: object.stream };
  }

  async remove(tenant: TenantContext, attachmentId: string): Promise<void> {
    const attachment = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, organizationId: tenant.organizationId },
    });

    if (!attachment) {
      throw AppException.notFound('attachment');
    }

    await this.prisma.attachment.delete({ where: { id: attachment.id } });
    await this.storage.delete(attachment.storageKey).catch(() => undefined);
  }

  private async assertTask(tenant: TenantContext, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, organizationId: tenant.organizationId },
      select: { id: true, projectId: true },
    });

    if (!task) {
      throw AppException.notFound('task');
    }

    return task;
  }

  private toDto(attachment: {
    id: string;
    organizationId: string;
    taskId: string | null;
    commentId: string | null;
    fileName: string;
    contentType: string;
    size: number;
    uploadedById: string;
    createdAt: Date;
  }): AttachmentDto {
    return {
      id: attachment.id,
      organizationId: attachment.organizationId,
      taskId: attachment.taskId,
      commentId: attachment.commentId,
      fileName: attachment.fileName,
      contentType: attachment.contentType,
      size: attachment.size,
      uploadedById: attachment.uploadedById,
      createdAt: attachment.createdAt.toISOString(),
    };
  }
}
