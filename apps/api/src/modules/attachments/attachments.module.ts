import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { isAllowedContentType } from '@teamflow/contracts';
import { APP_CONFIG, AppConfig } from '../../config/configuration';
import { AppException } from '../../common/errors';
import { CollaborationModule } from '../collaboration/collaboration.module';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { LocalStorageDriver } from './local-storage.driver';
import { S3StorageDriver } from './s3-storage.driver';
import { STORAGE_DRIVER, type StorageDriver } from './storage';

/**
 * Creates the storage driver of the current environment.
 *
 * `local` writes to the configured directory (the development default), `s3` talks to an
 * S3 compatible object storage through the AWS SDK.
 */
export function createStorageDriver(config: AppConfig): StorageDriver {
  if (config.storage.driver === 's3') {
    return new S3StorageDriver({
      bucket: config.storage.s3.bucket,
      region: config.storage.s3.region,
      endpoint: config.storage.s3.endpoint,
      accessKeyId: config.storage.s3.accessKeyId,
      secretAccessKey: config.storage.s3.secretAccessKey,
    });
  }
  return new LocalStorageDriver(config.storage.dir);
}

@Module({
  imports: [
    CollaborationModule,
    // The upload limits follow the configuration: a body that is too large is rejected while
    // it streams, and a file with a content type outside the allowlist never reaches the
    // service.
    MulterModule.registerAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        limits: {
          fileSize: config.storage.maxUploadBytes,
          files: 1,
          fields: 4,
        },
        fileFilter: (
          _request: unknown,
          file: { mimetype: string },
          callback: (error: Error | null, accept: boolean) => void,
        ) => {
          if (!isAllowedContentType(file.mimetype)) {
            callback(
              AppException.unsupportedMediaType(
                `The content type "${file.mimetype}" is not allowed.`,
              ),
              false,
            );
            return;
          }
          callback(null, true);
        },
      }),
    }),
  ],
  controllers: [AttachmentsController],
  providers: [
    AttachmentsService,
    {
      provide: STORAGE_DRIVER,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): StorageDriver => createStorageDriver(config),
    },
  ],
  exports: [AttachmentsService, STORAGE_DRIVER],
})
export class AttachmentsModule {}
