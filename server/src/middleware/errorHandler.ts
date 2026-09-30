import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { ApiError } from '../utils/ApiError.js';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(ApiError.notFound(`No route matches ${req.method} ${req.originalUrl}`));
};

interface MysqlError extends Error {
  code?: string;
  errno?: number;
  sqlMessage?: string;
}

function translateDatabaseError(error: MysqlError): ApiError {
  switch (error.code) {
    case 'ER_DUP_ENTRY':
      return ApiError.conflict('A record with those unique values already exists');
    case 'ECONNREFUSED':
    case 'PROTOCOL_CONNECTION_LOST':
    case 'ER_ACCESS_DENIED_ERROR':
      return new ApiError(503, 'DATABASE_UNAVAILABLE', 'The database is currently unavailable');
    default:
      return ApiError.internal();
  }
}

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  let apiError: ApiError;

  if (error instanceof ApiError) {
    apiError = error;
  } else if (error instanceof ZodError) {
    apiError = ApiError.unprocessable(
      'Request validation failed',
      error.issues.map((issue) => ({
        field: issue.path.length > 0 ? issue.path.join('.') : '(root)',
        message: issue.message,
      })),
    );
  } else if (error instanceof SyntaxError && 'body' in error) {
    apiError = ApiError.badRequest('Request body is not valid JSON');
  } else {
    const mysqlError = error as MysqlError;
    apiError = mysqlError.code ? translateDatabaseError(mysqlError) : ApiError.internal();
  }

  if (apiError.status >= 500) {
    logger.error(`${req.method} ${req.originalUrl} -> ${apiError.status}`, error);
  } else {
    logger.debug(`${req.method} ${req.originalUrl} -> ${apiError.status} ${apiError.message}`);
  }

  res.status(apiError.status).json({
    error: {
      code: apiError.code,
      message: apiError.message,
      ...(apiError.details ? { details: apiError.details } : {}),
      ...(config.isProduction ? {} : { stack: error instanceof Error ? error.stack : undefined }),
    },
  });
};
