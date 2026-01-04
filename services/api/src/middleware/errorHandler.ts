import { ERROR_CODES } from '@nyayamitra/shared';
import type { Context, ErrorHandler, MiddlewareHandler } from 'hono';

import { ApiError } from '../lib/errors';

function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export const handleError: ErrorHandler = (error, c: Context): Response => {
  if (isApiError(error)) {
    return c.json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      },
      error.statusCode
    );
  }

  console.error('Unhandled error', { error });

  return c.json(
    {
      error: {
        code: ERROR_CODES.INTERNAL_ERROR,
        message: 'Internal server error'
      }
    },
    500
  );
};

export const errorHandler = (): MiddlewareHandler => {
  return async (c, next): Promise<Response | void> => {
    try {
      await next();
    } catch (error) {
      return handleError(error, c);
    }
  };
};
