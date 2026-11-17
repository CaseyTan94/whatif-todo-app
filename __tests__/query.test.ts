import { describe, expect, it } from 'vitest';
import {
  DEFAULT_QUERY,
  filterByStatus,
  isFiltering,
  paginate,
  runQuery,
  searchTodos,
  sortTodos,
  totalPagesFor,
  updateQuery,
  type TodoQuery,
} from '@/lib/query';
import type { Todo } from '@/types/todo';

let seq = 0;
function todo(overrides: Partial<Todo> = {}): Todo {
  seq += 1;
  return {
    id: `t${seq}`,
    description: `Task ${seq}`,
    category: 'Personal',
    dueDate: null,
    completed: false,
    order: seq,
    createdAt: '2026-11-18T00:00:00.000Z',
    updatedAt: '2026-11-18T00:00:00.000Z',
    ...overrides,
  };
}

/** n tasks with order 0..n-1 */
function many(n: number): Todo[] {
  return Array.from({ length: n }, (_, i) => todo({ id: `m${i}`, order: i }));
}

const ids = (list: Todo[]) => list.map((t) => t.id);

describe('searchTodos', () => {
  const list = [
    todo({ id: 'a', description: 'Buy MILK and eggs' }),
    todo({ id: 'b', description: 'Email   the  landlord' }),
    todo({ id: 'c', description: 'Book dentist' }),
  ];

  it('matches regardless of case', () => {
    expect(ids(searchTodos(list, 'milk'))).toEqual(['a']);
    expect(ids(searchTodos(list, 'BOOK'))).toEqual(['c']);
  });

  it('trims the keyword and collapses extra spaces on both sides', () => {
    expect(ids(searchTodos(list, '  email the   landlord '))).toEqual(['b']);
  });

  it('matches a substring in the middle of the description', () => {
    expect(ids(searchTodos(list, 'and e'))).toEqual(['a']);
  });

  it('returns everything for an empty or whitespace-only search', () => {
    expect(searchTodos(list, '')).toHaveLength(3);
    expect(searchTodos(list, '   ')).toHaveLength(3);
  });

  it('returns nothing when no description matches', () => {
    expect(searchTodos(list, 'gym')).toEqual([]);
  });
});

describe('filterByStatus', () => {
  const list = [
    todo({ id: 'done', completed: true }),
    todo({ id: 'open1' }),
    todo({ id: 'open2' }),
  ];

  it('all keeps every task', () => {
    expect(ids(filterByStatus(list, 'all'))).toEqual(['done', 'open1', 'open2']);
  });

  it('completed keeps only completed tasks', () => {
    expect(ids(filterByStatus(list, 'completed'))).toEqual(['done']);
  });

  it('incomplete keeps only incomplete tasks', () => {
    expect(ids(filterByStatus(list, 'incomplete'))).toEqual(['open1', 'open2']);
  });
});

describe('sortTodos', () => {
  const list = [
    todo({ id: 'none1', dueDate: null, order: 0 }),
    todo({ id: 'dec', dueDate: '2026-12-01', order: 1 }),
    todo({ id: 'nov', dueDate: '2026-11-20', order: 2 }),
    todo({ id: 'none2', dueDate: null, order: 3 }),
    todo({ id: 'jan', dueDate: '2027-01-05', order: 4 }),
  ];

  it('ascending puts the soonest first and tasks without a due date last', () => {
    expect(ids(sortTodos(list, 'asc'))).toEqual(['nov', 'dec', 'jan', 'none1', 'none2']);
  });

  it('descending puts the latest first and still keeps tasks without a due date last', () => {
    expect(ids(sortTodos(list, 'desc'))).toEqual(['jan', 'dec', 'nov', 'none1', 'none2']);
  });

  it('breaks ties on the same due date by manual order', () => {
    const tied = [
      todo({ id: 'second', dueDate: '2026-11-20', order: 5 }),
      todo({ id: 'first', dueDate: '2026-11-20', order: 1 }),
    ];
    expect(ids(sortTodos(tied, 'asc'))).toEqual(['first', 'second']);
    expect(ids(sortTodos(tied, 'desc'))).toEqual(['first', 'second']);
  });

  it('manual sorts by order', () => {
    const shuffled = [list[3], list[0], list[4], list[2], list[1]];
    expect(ids(sortTodos(shuffled, 'manual'))).toEqual(['none1', 'dec', 'nov', 'none2', 'jan']);
  });

  it('does not mutate the input array', () => {
    const copy = [...list];
    sortTodos(list, 'desc');
    expect(list).toEqual(copy);
  });
});

describe('paginate', () => {
  it('handles an empty list as page 1 of 1', () => {
    expect(paginate([], 1, 10)).toEqual({ items: [], total: 0, page: 1, totalPages: 1 });
  });

  it('handles a total that is an exact multiple of the page size', () => {
    const view = paginate(many(20), 2, 10);
    expect(view.totalPages).toBe(2);
    expect(ids(view.items)).toEqual(ids(many(20).slice(10, 20)));
  });

  it('returns a partial last page', () => {
    const view = paginate(many(23), 3, 10);
    expect(view.totalPages).toBe(3);
    expect(view.items).toHaveLength(3);
    expect(view.items[0].id).toBe('m20');
  });

  it('clamps a page past the end to the last page (e.g. after deleting its last item)', () => {
    // 21 tasks at 10/page = 3 pages; delete the 21st and page 3 no longer exists.
    const view = paginate(many(20), 3, 10);
    expect(view.page).toBe(2);
    expect(view.items).toHaveLength(10);
  });

  it('clamps page 0, negatives and NaN to page 1', () => {
    expect(paginate(many(5), 0, 10).page).toBe(1);
    expect(paginate(many(5), -3, 10).page).toBe(1);
    expect(paginate(many(5), Number.NaN, 10).page).toBe(1);
  });

  it('totalPages is never below 1', () => {
    expect(totalPagesFor(0, 5)).toBe(1);
    expect(totalPagesFor(5, 5)).toBe(1);
    expect(totalPagesFor(6, 5)).toBe(2);
  });
});

describe('runQuery', () => {
  it('applies search, then status, then sort, then pagination', () => {
    const list = [
      todo({ id: 'w1', description: 'Write report', dueDate: '2026-11-25' }),
      todo({ id: 'w2', description: 'write tests', dueDate: '2026-11-19' }),
      todo({ id: 'w3', description: 'Write README', dueDate: '2026-11-20', completed: true }),
      todo({ id: 'w4', description: 'Rewrite intro', dueDate: null }),
      todo({ id: 'x', description: 'Groceries', dueDate: '2026-11-18' }),
    ];
    const query: TodoQuery = {
      ...DEFAULT_QUERY,
      search: 'write',
      status: 'incomplete',
      sortDir: 'asc',
      pageSize: 5,
    };
    const view = runQuery(list, query);
    expect(ids(view.items)).toEqual(['w2', 'w1', 'w4']);
    expect(view.total).toBe(3);
    expect(view.totalPages).toBe(1);
  });

  it('counts total across all pages, not just the current one', () => {
    const view = runQuery(many(12), { ...DEFAULT_QUERY, pageSize: 5, page: 3 });
    expect(view.total).toBe(12);
    expect(view.items).toHaveLength(2);
    expect(view.page).toBe(3);
  });
});

describe('updateQuery', () => {
  const onPage3: TodoQuery = { ...DEFAULT_QUERY, page: 3 };

  it.each<[string, Partial<TodoQuery>]>([
    ['search', { search: 'milk' }],
    ['status', { status: 'completed' }],
    ['sort', { sortDir: 'desc' }],
    ['page size', { pageSize: 20 }],
  ])('resets to page 1 when %s changes', (_, patch) => {
    expect(updateQuery(onPage3, patch).page).toBe(1);
  });

  it('keeps the page when only the page changes', () => {
    expect(updateQuery(onPage3, { page: 4 }).page).toBe(4);
  });

  it('keeps the page when a field is set to its current value', () => {
    expect(updateQuery(onPage3, { search: '' }).page).toBe(3);
  });

  it('uses an explicit page from the same patch instead of resetting', () => {
    expect(updateQuery(onPage3, { status: 'completed', page: 2 }).page).toBe(2);
  });
});

describe('isFiltering', () => {
  it('is false for the default query and whitespace-only search', () => {
    expect(isFiltering(DEFAULT_QUERY)).toBe(false);
    expect(isFiltering({ search: '   ', status: 'all' })).toBe(false);
  });

  it('is true when search or status narrows the list', () => {
    expect(isFiltering({ search: 'milk', status: 'all' })).toBe(true);
    expect(isFiltering({ search: '', status: 'incomplete' })).toBe(true);
  });
});
