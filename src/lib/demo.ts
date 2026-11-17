import dayjs, { type Dayjs } from 'dayjs';
import type { Category, Todo } from '@/types/todo';
import { newId } from './id';
import { DATE_FORMAT } from './validation';

// [description, category, due in N days (null = no date), completed]
const SAMPLES: [string, Category, number | null, boolean][] = [
  ['Renew car insurance', 'Urgent', -1, false],
  ['Submit monthly expense report', 'Work', 0, false],
  ['Book dentist appointment', 'Personal', 2, false],
  ['Prepare slides for Monday stand-up', 'Work', 3, false],
  ['Pay electricity bill', 'Urgent', 1, false],
  ['Call mum', 'Personal', null, false],
  ['Review pull request for the login page', 'Work', 0, true],
  ['Buy groceries: rice, eggs, vegetables', 'Personal', 0, false],
  ['Plan weekend hike', 'Personal', 5, false],
  ['Update project timeline', 'Work', 6, false],
  ['Fix the leaking kitchen tap', 'Personal', -3, true],
  ['Back up laptop', 'Personal', 9, false],
];

/**
 * Sample tasks for a first visit, with due dates relative to `today` so the
 * overdue badge and the calendar always have something to show.
 */
export function demoTodos(today: Dayjs = dayjs(), startOrder = 0): Todo[] {
  const now = new Date().toISOString();
  return SAMPLES.map(([description, category, dueIn, completed], i) => ({
    id: newId(),
    description,
    category,
    dueDate: dueIn === null ? null : today.add(dueIn, 'day').format(DATE_FORMAT),
    completed,
    order: startOrder + i,
    createdAt: now,
    updatedAt: now,
  }));
}
