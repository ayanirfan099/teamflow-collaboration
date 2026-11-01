import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@teamflow/database';
import { AppException } from '../errors';

export interface IdempotencyLookup {
  statusCode: number;
  body: unknown;
}

/**
 * Makes retries of a state changing request safe.
 *
 * The client sends an `idempotency-key` header; the key is stored together with a hash of the
 * request body. A repeated request with the same key returns the stored response, a repeated
 * key with a different body is an error.
 */
@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaClient) {}

  static hashRequest(body: unknown): string {
    return createHash('sha256')
      .update(JSON.stringify(body ?? null))
      .digest('hex');
  }

  async lookup(
    userId: string,
    key: string,
    requestHash: string,
  ): Promise<IdempotencyLookup | null> {
    const record = await this.prisma.idempotencyRecord.findUnique({
      where: { userId_key: { userId, key } },
    });
    if (!record) {
      return null;
    }
    if (record.requestHash !== requestHash) {
      throw AppException.conflict(
        'idempotency_key_reused',
        'The idempotency key was already used with a different payload.',
      );
    }
    return { statusCode: record.statusCode, body: record.responseBody };
  }

  async store(
    userId: string,
    key: string,
    method: string,
    path: string,
    requestHash: string,
    statusCode: number,
    body: unknown,
  ): Promise<void> {
    await this.prisma.idempotencyRecord
      .create({
        data: {
          userId,
          key,
          method,
          path,
          requestHash,
          statusCode,
          responseBody: (body ?? null) as never,
        },
      })
      .catch(() => undefined);
  }
}
