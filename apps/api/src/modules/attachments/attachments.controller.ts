import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ALLOWED_ATTACHMENT_TYPES, ATTACHMENT_MAX_BYTES } from '@teamflow/contracts';
import type { Response } from 'express';
import { RequireCapability, Tenant } from '../../common/decorators';
import { AppException } from '../../common/errors';
import { TenantContext } from '../../common/types';
import { AttachmentsService } from './attachments.service';

/**
 * The attachment endpoints.
 *
 * The upload accepts `multipart/form-data` with a single field named `file`. The size limit is
 * enforced by the parser (so an oversized body is rejected while it streams) and again by the
 * service (so a limit that was configured smaller is never exceeded).
 */
@Controller('organizations/:organizationId')
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Get('tasks/:taskId/attachments')
  @RequireCapability('attachment:read')
  async list(@Tenant() tenant: TenantContext, @Param('taskId') taskId: string) {
    const data = await this.attachments.list(tenant, taskId);
    return { data, meta: { limit: data.length, hasMore: false, nextCursor: null } };
  }

  @Post('tasks/:taskId/attachments')
  @RequireCapability('attachment:write')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: ATTACHMENT_MAX_BYTES, files: 1, fields: 4 },
    }),
  )
  async upload(
    @Tenant() tenant: TenantContext,
    @Param('taskId') taskId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw AppException.validation('A file is required.');
    }
    const data = await this.attachments.upload(tenant, taskId, tenant.userId, {
      originalName: file.originalname,
      contentType: file.mimetype,
      buffer: file.buffer,
      size: file.size,
    });
    return { data };
  }

  /**
   * Streams the file.
   *
   * The response is always a download: the content type is `application/octet-stream` and
   * `nosniff` prevents the browser from interpreting the bytes as an active document.
   */
  @Get('attachments/:attachmentId/download')
  @RequireCapability('attachment:read')
  async download(
    @Tenant() tenant: TenantContext,
    @Param('attachmentId') attachmentId: string,
    @Res() response: Response,
  ): Promise<void> {
    const { attachment, stream } = await this.attachments.open(tenant, attachmentId);

    response.setHeader('Content-Type', 'application/octet-stream');
    response.setHeader('Content-Length', String(attachment.size));
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${attachment.fileName.replace(/["\\\r\n]/g, '_')}"`,
    );

    await new Promise<void>((resolve, reject) => {
      stream.on('error', reject);
      response.on('finish', () => resolve());
      response.on('close', () => resolve());
      stream.pipe(response);
    });
  }

  @Delete('attachments/:attachmentId')
  @RequireCapability('attachment:write')
  async remove(@Tenant() tenant: TenantContext, @Param('attachmentId') attachmentId: string) {
    await this.attachments.remove(tenant, attachmentId);
    return { data: { id: attachmentId, deleted: true } };
  }

  /** The content types the API accepts. */
  @Get('attachments/types')
  @RequireCapability('attachment:read')
  types() {
    return { data: { allowed: ALLOWED_ATTACHMENT_TYPES, maxBytes: ATTACHMENT_MAX_BYTES } };
  }
}
