import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Every error the API returns carries a stable machine readable code. The codes are part of
 * the API contract (see `docs/api-conventions.md`).
 */
export type AppErrorCode =
  | 'validation_failed'
  | 'bad_request'
  | 'unauthenticated'
  | 'invalid_credentials'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'duplicate'
  | 'csrf_failed'
  | 'rate_limited'
  | 'idempotency_key_reused'
  | 'invitation_expired'
  | 'invitation_already_used'
  | 'invalid_role_change'
  | 'cannot_remove_self'
  | 'invalid_assignee'
  | 'invalid_label'
  | 'last_owner'
  | 'payload_too_large'
  | 'unsupported_media_type'
  | 'database_unavailable'
  | 'internal_error';

export class AppException extends HttpException {
  readonly code: string;
  readonly httpStatus: number;
  readonly details?: unknown;

  constructor(code: string, message: string, httpStatus: number, details?: unknown) {
    super({ code, message, details }, httpStatus);
    this.name = 'AppException';
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
  }

  static badRequest(
    code: AppErrorCode = 'bad_request',
    message = 'Bad request.',
    details?: unknown,
  ) {
    return new AppException(code, message, HttpStatus.BAD_REQUEST, details);
  }

  static validation(message = 'The request payload is invalid.', details?: unknown) {
    return new AppException('validation_failed', message, HttpStatus.BAD_REQUEST, details);
  }

  static unauthenticated(message = 'Authentication is required.') {
    return new AppException('unauthenticated', message, HttpStatus.UNAUTHORIZED);
  }

  static invalidCredentials(message = 'Email or password is incorrect.') {
    // The same message and status for an unknown email and a wrong password, so the endpoint
    // cannot be used to find registered addresses.
    return new AppException('invalid_credentials', message, HttpStatus.UNAUTHORIZED);
  }

  static forbidden(code: AppErrorCode = 'forbidden', message = 'You are not allowed to do that.') {
    return new AppException(code, message, HttpStatus.FORBIDDEN);
  }

  /** A missing resource. The code contains the resource, e.g. `task_not_found`. */
  static notFound(resource = 'resource') {
    return new AppException(
      `${resource}_not_found`,
      `The requested ${resource} was not found.`,
      HttpStatus.NOT_FOUND,
      { resource },
    );
  }

  static conflict(
    code: AppErrorCode = 'conflict',
    message = 'The resource changed in the meantime.',
    details?: unknown,
  ) {
    return new AppException(code, message, HttpStatus.CONFLICT, details);
  }

  static unprocessable(code: AppErrorCode, message: string, details?: unknown) {
    return new AppException(code, message, HttpStatus.UNPROCESSABLE_ENTITY, details);
  }

  static tooLarge(message = 'The payload is too large.') {
    return new AppException('payload_too_large', message, HttpStatus.PAYLOAD_TOO_LARGE);
  }

  static unsupportedMediaType(message = 'The content type is not supported.', details?: unknown) {
    return new AppException(
      'unsupported_media_type',
      message,
      HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      details,
    );
  }

  static tooManyRequests(message = 'Too many requests. Please try again later.') {
    return new AppException('rate_limited', message, HttpStatus.TOO_MANY_REQUESTS);
  }

  static internal(message = 'The request could not be completed.') {
    return new AppException('internal_error', message, HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
