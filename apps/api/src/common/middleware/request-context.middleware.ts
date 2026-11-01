import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * Assigns a request id to every request.
 *
 * The middleware runs before the guards, so even a rejected request carries an id that ties
 * the response to the log entry. An id that a proxy already set (`x-request-id`) is reused.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const incoming = request.headers['x-request-id'];
    const requestId = (Array.isArray(incoming) ? incoming[0] : incoming) ?? randomUUID();

    request.context = { ...(request.context ?? {}), requestId };
    response.setHeader('x-request-id', requestId);

    next();
  }
}
