import { CATEGORIES, type Category } from '@/types/todo';

export { CATEGORIES };

/**
 * Single source of truth for category colours. List tags, the form and the
 * calendar all read from here so the colour scheme stays consistent.
 * Values are antd preset colour names, usable directly as <Tag color={...}>.
 */
export const CATEGORY_COLORS: Record<Category, string> = {
  Work: 'blue',
  Personal: 'green',
  Urgent: 'red',
};

export function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && (CATEGORIES as string[]).includes(value);
}
