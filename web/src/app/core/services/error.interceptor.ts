import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, from, Observable, switchMap } from 'rxjs';
import { ApiErrorBody, ApiRequestError, FieldIssue } from '../models/api-error.model';

function isErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof (value as ApiErrorBody).error?.code === 'string'
  );
}

function toApiRequestError(status: number, body: unknown, fallback: string): ApiRequestError {
  if (status === 0) {
    return new ApiRequestError(
      0,
      'NETWORK_ERROR',
      'Could not reach the API. Check that the server is running and try again.',
    );
  }

  if (isErrorBody(body)) {
    const details = body.error.details;
    const issues: FieldIssue[] = Array.isArray(details)
      ? details.filter(
          (item): item is FieldIssue =>
            typeof item === 'object' && item !== null && 'field' in item && 'message' in item,
        )
      : [];

    return new ApiRequestError(
      status,
      body.error.code || 'ERROR',
      body.error.message || fallback,
      issues,
    );
  }

  return new ApiRequestError(status, 'ERROR', fallback || `Request failed with status ${status}`);
}

function parseBlob(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // Non-JSON blob body: fall through to the generic message.
    return null;
  }
}

/** Emits `error` on an Observable<never>, which stays assignable to the interceptor. */
function fail(error: unknown): Observable<never> {
  return new Observable<never>((subscriber) => subscriber.error(error));
}

/**
 * Normalises every failing HTTP response into ApiRequestError.
 *
 * Blob responses (the PDF download uses responseType 'blob') carry the JSON
 * error envelope as a Blob, so it is decoded before mapping.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((error: unknown): Observable<never> => {
      if (!(error instanceof HttpErrorResponse)) {
        return fail(error);
      }

      const fallback = error.message || 'Request failed';

      if (error.error instanceof Blob) {
        return from(error.error.text()).pipe(
          switchMap((text): Observable<never> =>
            fail(toApiRequestError(error.status, parseBlob(text), fallback)),
          ),
          catchError((): Observable<never> =>
            fail(toApiRequestError(error.status, null, fallback)),
          ),
        );
      }

      return fail(toApiRequestError(error.status, error.error, fallback));
    }),
  );
