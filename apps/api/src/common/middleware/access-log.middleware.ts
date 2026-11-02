import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { AppLogger } from '../logging/app-logger';

/**
 * Writes one structured line per request.
 *
 * The line contains the request id (which is also the `x-request-id` header of the response),
 * the method, the path, the status and the duration. It never contains a query string, a
 * body, a cookie or a header — the log has to stay free of anything that could carry a
 * secret or personal data.
 */
@Injectable()
export class AccessLogMiddleware implements NestMiddleware {
  constructor(private readonly logger: AppLogger) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const startedAt = Date.now();

    response.on('finish', () => {
      const context = {
        requestId: request.context?.requestId,
        method: request.method,
        path: request.path,
        status: response.statusCode,
        durationMs: Date.now() - startedAt,
      };

      if (response.statusCode >= 500) {
        this.logger.error('request failed', context);
        return;
      }
      this.logger.info('request completed', context);
    });

    next();
  }
}
