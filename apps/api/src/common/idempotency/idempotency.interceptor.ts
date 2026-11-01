import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { type Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { IdempotencyService } from './idempotency.service';
import { IDEMPOTENT_KEY } from '../decorators';

/**
 * Replays the stored response of a repeated request.
 *
 * The stored response is only written after the handler succeeded, so a failed request can be
 * retried with the same key.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly idempotency: IdempotencyService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const isIdempotent =
      this.reflector.getAllAndOverride<boolean>(IDEMPOTENT_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false;

    if (!isIdempotent) {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const key = request.headers['idempotency-key'];
    const userId = request.context?.user?.id;
    if (typeof key !== 'string' || key.length === 0 || !userId) {
      return next.handle();
    }

    const requestHash = IdempotencyService.hashRequest(request.body);
    const stored = await this.idempotency.lookup(userId, key, requestHash);
    if (stored) {
      response.status(stored.statusCode);
      return of(stored.body);
    }

    return next.handle().pipe(
      tap(async (body) => {
        const statusCode = response.statusCode;
        if (statusCode >= 200 && statusCode < 300) {
          await this.idempotency.store(
            userId,
            key,
            request.method,
            request.path,
            requestHash,
            statusCode,
            body,
          );
        }
      }),
    );
  }
}
