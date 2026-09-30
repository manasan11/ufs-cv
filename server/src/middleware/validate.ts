import type { RequestHandler } from 'express';
import type { ZodTypeAny, z } from 'zod';
import { ApiError } from '../utils/ApiError.js';
import type { FieldIssue } from '../utils/ApiError.js';

export interface ValidationTargets {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
}

function toFieldIssues(error: z.ZodError): FieldIssue[] {
  return error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join('.') : '(root)',
    message: issue.message,
  }));
}

/**
 * Validates and replaces the request parts with the parsed (coerced) values so
 * handlers always work with typed data.
 */
export function validate(targets: ValidationTargets): RequestHandler {
  return (req, _res, next) => {
    try {
      if (targets.params) {
        req.params = targets.params.parse(req.params) as typeof req.params;
      }
      if (targets.query) {
        const parsed = targets.query.parse(req.query);
        Object.defineProperty(req, 'query', { value: parsed, writable: true, configurable: true });
      }
      if (targets.body) {
        req.body = targets.body.parse(req.body);
      }
      next();
    } catch (error) {
      if (error instanceof ApiError) {
        next(error);
        return;
      }
      if (error && typeof error === 'object' && 'issues' in error) {
        next(ApiError.unprocessable('Request validation failed', toFieldIssues(error as z.ZodError)));
        return;
      }
      next(error);
    }
  };
}
