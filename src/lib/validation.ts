import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { isCategory } from '@/lib/categories';
import type { NewTodoInput } from '@/types/todo';

dayjs.extend(customParseFormat);

export const DESCRIPTION_MAX = 200;
export const DATE_FORMAT = 'YYYY-MM-DD';

export function isValidDateString(value: unknown): value is string {
  return typeof value === 'string' && dayjs(value, DATE_FORMAT, true).isValid();
}

/**
 * Rules from PLAN §3: description required, trimmed, 1–200 chars; category
 * one of the three; dueDate a valid YYYY-MM-DD string or null.
 * Returns an error message, or null when the input is valid.
 * Pure so the form, the hook and (Thu) the CSV importer can share it.
 */
export function validateTodoInput(input: NewTodoInput): string | null {
  const description = input.description.trim();
  if (description.length === 0) return 'Description is required.';
  if (description.length > DESCRIPTION_MAX) {
    return `Description must be ${DESCRIPTION_MAX} characters or fewer.`;
  }
  if (!isCategory(input.category)) return 'Category must be Work, Personal or Urgent.';
  if (input.dueDate !== null && !isValidDateString(input.dueDate)) {
    return 'Due date must be a valid date.';
  }
  return null;
}

/** Today's date as YYYY-MM-DD in the user's local time zone. */
export function todayString(): string {
  return dayjs().format(DATE_FORMAT);
}

/** Overdue = has a due date before today and isn't done. String compare is safe for YYYY-MM-DD. */
export function isOverdue(dueDate: string | null, completed: boolean, today = todayString()): boolean {
  return !completed && dueDate !== null && dueDate < today;
}
