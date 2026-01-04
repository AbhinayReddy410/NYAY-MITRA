import type { ContentfulStatusCode } from 'hono/utils/http-status';

import { ERROR_CODES } from '@nyayamitra/shared';

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export class ApiError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: ContentfulStatusCode;
  public readonly details?: unknown;

  public constructor(code: ErrorCode, message: string, statusCode: ContentfulStatusCode, details?: unknown) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.name = 'ApiError';
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export function notFound(message: string = 'Not found', details?: unknown): ApiError {
  return new ApiError(ERROR_CODES.NOT_FOUND, message, 404, details);
}

export function validationError(message: string = 'Validation error', details?: unknown): ApiError {
  return new ApiError(ERROR_CODES.VALIDATION_ERROR, message, 400, details);
}

export function forbidden(message: string = 'Forbidden', details?: unknown): ApiError {
  return new ApiError(ERROR_CODES.FORBIDDEN, message, 403, details);
}

export function authRequired(message: string = 'Authentication required', details?: unknown): ApiError {
  return new ApiError(ERROR_CODES.AUTH_REQUIRED, message, 401, details);
}
