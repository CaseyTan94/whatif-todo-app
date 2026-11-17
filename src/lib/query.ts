import type { PageSize, Todo } from '@/types/todo';

/**
 * The list pipeline, as pure functions with no React:
 *
 *   todos → search → status → sort → paginate → { items, total, page, totalPages }
 */

export type StatusFilter = 'all' | 'completed' | 'incomplete';
/** 'asc' / 'desc' sort by due date; 'manual' sorts by `order` (enables drag-and-drop on Fri). */
export type SortDir = 'asc' | 'desc' | 'manual';

export const PAGE_SIZES: PageSize[] = [5, 10, 15, 20];

export interface TodoQuery {
  search: string;
  status: StatusFilter;
  sortDir: SortDir;
  page: number; // 1-based
  pageSize: PageSize;
}

export interface TodoView {
  items: Todo[]; // the current page
  total: number; // tasks matching search + status, across all pages
  page: number; // clamped into 1..totalPages
  totalPages: number; // always >= 1, so the label never reads "Page 1 of 0"
}

export const DEFAULT_QUERY: TodoQuery = {
  search: '',
  status: 'all',
  sortDir: 'asc',
  page: 1,
  pageSize: 10,
};

/** Lower-case, trim and collapse runs of whitespace, so "  Buy   MILK " matches "buy milk". */
export function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function searchTodos(todos: Todo[], search: string): Todo[] {
  const needle = normalizeText(search);
  if (!needle) return todos;
  return todos.filter((t) => normalizeText(t.description).includes(needle));
}

export function filterByStatus(todos: Todo[], status: StatusFilter): Todo[] {
  if (status === 'all') return todos;
  const wantCompleted = status === 'completed';
  return todos.filter((t) => t.completed === wantCompleted);
}

/**
 * Returns a new sorted array. Tasks with no due date always go last, in both
 * directions. Ties fall back to manual `order` so the result is deterministic.
 * YYYY-MM-DD strings sort correctly as plain strings.
 */
export function sortTodos(todos: Todo[], sortDir: SortDir): Todo[] {
  const byOrder = (a: Todo, b: Todo) => a.order - b.order;
  if (sortDir === 'manual') return [...todos].sort(byOrder);

  const sign = sortDir === 'asc' ? 1 : -1;
  return [...todos].sort((a, b) => {
    if (a.dueDate === b.dueDate) return byOrder(a, b);
    if (a.dueDate === null) return 1;
    if (b.dueDate === null) return -1;
    return (a.dueDate < b.dueDate ? -1 : 1) * sign;
  });
}

export function totalPagesFor(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/** Clamp `page` into range so deleting the last item on page 3 lands on page 2, not a blank page. */
export function paginate(items: Todo[], page: number, pageSize: number): TodoView {
  const total = items.length;
  const totalPages = totalPagesFor(total, pageSize);
  const safePage = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total,
    page: safePage,
    totalPages,
  };
}

export function runQuery(todos: Todo[], query: TodoQuery): TodoView {
  const searched = searchTodos(todos, query.search);
  const filtered = filterByStatus(searched, query.status);
  const sorted = sortTodos(filtered, query.sortDir);
  return paginate(sorted, query.page, query.pageSize);
}

/**
 * Apply a partial change to the query. Changing search, status, sort or page
 * size resets to page 1 unless the patch sets `page` itself.
 */
export function updateQuery(prev: TodoQuery, patch: Partial<TodoQuery>): TodoQuery {
  const next = { ...prev, ...patch };
  const resetsPage =
    next.search !== prev.search ||
    next.status !== prev.status ||
    next.sortDir !== prev.sortDir ||
    next.pageSize !== prev.pageSize;
  if (resetsPage && patch.page === undefined) next.page = 1;
  return next;
}

/** True when search or status is narrowing the list (sort and paging don't hide tasks). */
export function isFiltering(query: Pick<TodoQuery, 'search' | 'status'>): boolean {
  return normalizeText(query.search) !== '' || query.status !== 'all';
}
