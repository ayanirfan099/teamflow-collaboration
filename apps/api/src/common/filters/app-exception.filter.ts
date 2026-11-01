import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Prisma } from '@teamflow/database';
import type { Response } from 'express';
import { inspect } from 'node:util';
import { AppLogger } from '../logging/app-logger';
import { AppException } from '../errors';

/**
 * Turns every exception into the error envelope of the API contract.
 *
 * Internal errors never leak a stack trace or a database message to the client — the details
 * are logged, the response only carries a stable code and a generic message.
 */
@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<{
      context?: { requestId?: string };
      method: string;
      url: string;
    }>();
    const requestId = request.context?.requestId;

    const { status, code, message, details } = this.describe(exception);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error('request failed', {
        requestId,
        method: request.method,
        url: request.url,
        status,
        code,
        exception: describeException(exception),
      });
    } else {
      this.logger.debug('request rejected', {
        requestId,
        method: request.method,
        url: request.url,
        status,
        code,
      });
    }

    response.status(status).json({
      error: {
        code,
        message,
        ...(details === undefined ? {} : { details }),
        ...(requestId ? { requestId } : {}),
      },
    });
  }

  private describe(exception: unknown): {
    status: number;
    code: string;
    message: string;
    details?: unknown;
  } {
    if (exception instanceof AppException) {
      return {
        status: exception.httpStatus,
        code: exception.code,
        message: exception.message,
        details: exception.details,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const message =
        typeof payload === 'string'
          ? payload
          : (((payload as { message?: unknown }).message as string | undefined) ??
            exception.message);
      const code =
        typeof payload === 'object' && payload !== null && 'code' in payload
          ? String((payload as { code?: unknown }).code)
          : status === HttpStatus.NOT_FOUND
            ? 'not_found'
            : status === HttpStatus.BAD_REQUEST
              ? 'bad_request'
              : 'request_failed';
      return { status, code, message: Array.isArray(message) ? message.join(', ') : message };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return {
          status: HttpStatus.CONFLICT,
          code: 'duplicate',
          message: 'A resource with these values already exists.',
        };
      }
      if (exception.code === 'P2025') {
        return {
          status: HttpStatus.NOT_FOUND,
          code: 'not_found',
          message: 'The requested resource was not found.',
        };
      }
      if (exception.code === 'P2003') {
        return {
          status: HttpStatus.BAD_REQUEST,
          code: 'bad_request',
          message: 'A referenced resource does not exist.',
        };
      }
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'internal_error',
      message: 'The request could not be completed.',
    };
  }
}

function describeException(exception: unknown): string {
  if (exception instanceof Error) {
    return `${exception.name}: ${exception.message}\n${exception.stack ?? ''}`;
  }
  return inspect(exception, { depth: 3 });
}
