export interface FieldIssue {
  field: string;
  message: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Normalised client-side error. Every failure surfaced to the UI is one of
 * these, so components never inspect HttpErrorResponse directly.
 */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly issues: FieldIssue[];

  constructor(status: number, code: string, message: string, issues: FieldIssue[] = []) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.issues = issues;
  }

  get isValidation(): boolean {
    return this.status === 422;
  }

  get isAuth(): boolean {
    return this.status === 401 || this.status === 403;
  }

  get isOffline(): boolean {
    return this.status === 0;
  }

  /** Field issues keyed by dotted path, for mapping onto form controls. */
  get issuesByField(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const issue of this.issues) {
      if (!(issue.field in result)) result[issue.field] = issue.message;
    }
    return result;
  }
}

export function isApiRequestError(value: unknown): value is ApiRequestError {
  return value instanceof ApiRequestError;
}
