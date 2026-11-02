import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';
import type { StorageDriver } from './storage';

export interface S3StorageOptions {
  bucket?: string;
  region: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  /** Optional prefix inside the bucket, useful to separate environments. */
  prefix?: string;
}

/**
 * The S3 compatible driver (production).
 *
 * It works with AWS S3 and with every S3 compatible service (MinIO, R2, …) through the
 * optional endpoint. The credentials are never written to a log.
 */
export class S3StorageDriver implements StorageDriver {
  readonly name = 's3' as const;
  private readonly bucket: string;
  private readonly prefix: string;
  private readonly client: S3Client;

  constructor(options: S3StorageOptions) {
    if (!options.bucket) {
      throw new Error('S3_BUCKET has to be set when the storage driver is "s3".');
    }
    this.bucket = options.bucket;
    this.prefix = options.prefix ? `${options.prefix.replace(/^\/+|\/+$/g, '')}/` : '';

    const config: S3ClientConfig = {
      region: options.region,
      ...(options.endpoint ? { endpoint: options.endpoint, forcePathStyle: true } : {}),
      ...(options.accessKeyId && options.secretAccessKey
        ? {
            credentials: {
              accessKeyId: options.accessKeyId,
              secretAccessKey: options.secretAccessKey,
            },
          }
        : {}),
    };

    this.client = new S3Client(config);
  }

  private keyFor(key: string): string {
    return `${this.prefix}${key}`;
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.keyFor(key),
        Body: body,
        ContentType: contentType,
        // The object is private: the API streams it with an authorisation check.
        ServerSideEncryption: 'AES256',
      }),
    );
  }

  async get(key: string): Promise<{ stream: Readable; size: number } | null> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: this.keyFor(key) }),
      );
      if (!result.Body) {
        return null;
      }
      const body = result.Body as Readable;
      return { stream: body, size: result.ContentLength ?? 0 };
    } catch (error) {
      const name = (error as { name?: string }).name;
      if (name === 'NoSuchKey' || name === 'NotFound') {
        return null;
      }
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: this.keyFor(key) }));
  }
}
