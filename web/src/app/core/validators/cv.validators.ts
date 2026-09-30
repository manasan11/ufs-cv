import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Mirrors the API's YYYY-MM guard for <input type="month"> values. */
export function monthValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (value === null || value === undefined || value === '') return null;
    return MONTH_PATTERN.test(String(value)) ? null : { month: true };
  };
}

/**
 * Cross-field check: an end date must not precede the start date. Apply to the
 * end control with `{ start: 'startDate', end: 'endDate' }`.
 */
export function dateRangeValidator(startKey: string, endKey: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const start = control.parent?.get(startKey)?.value;
    const end = control.value;
    if (!start || !end) return null;
    return String(end) < String(start) ? { dateOrder: true } : null;
  };
}
