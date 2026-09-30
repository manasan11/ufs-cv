const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])(-\d{2})?$/;

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

export function isMonth(value: unknown): value is string {
  return typeof value === 'string' && MONTH_PATTERN.test(value);
}

/**
 * Normalises anything the database may return to the `YYYY-MM` precision used
 * across the API. Accepts Date objects and `YYYY-MM-DD` strings.
 */
export function toMonth(value: string | Date | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;

  if (value instanceof Date) {
    return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}`;
  }

  return String(value).slice(0, 7);
}

/**
 * Converts an API `YYYY-MM` value into a storable DATE string. Dates are stored
 * as the first day of the month because the domain has month-level precision
 * only; `toMonth` converts them back on the way out.
 */
export function toStorageDate(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  const month = String(value).slice(0, 7);
  return `${month}-01`;
}
