import { describe, expect, it } from 'vitest';
import dayjs from 'dayjs';
import { demoTodos } from '@/lib/demo';
import { groupByDueDate, sortTodos } from '@/lib/query';
import { reorderTodos } from '@/lib/reorder';
import { sanitizeTodo } from '@/lib/storage';
import { validateTodoInput } from '@/lib/validation';
import type { Todo } from '@/types/todo';

function todo(id: string, order: number, overrides: Partial<Todo> = {}): Todo {
  return {
    id,
    description: `Task ${id}`,
    category: 'Personal',
    dueDate: null,
    completed: false,
    order,
    createdAt: '2026-11-20T00:00:00.000Z',
    updatedAt: '2026-11-20T00:00:00.000Z',
    ...overrides,
  };
}

/** ids in manual order */
const manual = (list: Todo[]) => sortTodos(list, 'manual').map((t) => t.id);

describe('reorderTodos', () => {
  const list = [todo('a', 0), todo('b', 1), todo('c', 2), todo('d', 3)];
  const all = ['a', 'b', 'c', 'd'];

  it('moves a task down', () => {
    expect(manual(reorderTodos(list, all, 'a', 'c'))).toEqual(['b', 'c', 'a', 'd']);
  });

  it('moves a task up', () => {
    expect(manual(reorderTodos(list, all, 'd', 'b'))).toEqual(['a', 'd', 'b', 'c']);
  });

  it('returns the same array when nothing moves', () => {
    expect(reorderTodos(list, all, 'b', 'b')).toBe(list);
    expect(reorderTodos(list, all, 'b', 'zzz')).toBe(list);
  });

  it('only touches the visible tasks; hidden ones keep their place', () => {
    // Page shows a, c, d (b is filtered out). Drag d to the top of the page.
    const result = reorderTodos(list, ['a', 'c', 'd'], 'd', 'a');
    expect(manual(result)).toEqual(['d', 'b', 'a', 'c']);
    expect(result.find((t) => t.id === 'b')).toBe(list[1]); // untouched object
  });

  it('does not change updatedAt', () => {
    const result = reorderTodos(list, all, 'a', 'd');
    expect(result.every((t) => t.updatedAt === '2026-11-20T00:00:00.000Z')).toBe(true);
  });

  it('copes with duplicate order values by renumbering first', () => {
    const dupes = [todo('a', 0), todo('b', 0), todo('c', 0)];
    const result = reorderTodos(dupes, ['a', 'b', 'c'], 'c', 'a');
    expect(manual(result)).toEqual(['c', 'a', 'b']);
    expect(new Set(result.map((t) => t.order)).size).toBe(3);
  });
});

describe('groupByDueDate', () => {
  it('groups by date, skips undated tasks, and lists incomplete tasks first', () => {
    const groups = groupByDueDate([
      todo('a', 0, { dueDate: '2026-11-20', completed: true }),
      todo('b', 1, { dueDate: '2026-11-20' }),
      todo('c', 2, { dueDate: '2026-11-21' }),
      todo('d', 3),
    ]);
    expect([...groups.keys()]).toEqual(['2026-11-20', '2026-11-21']);
    expect(groups.get('2026-11-20')!.map((t) => t.id)).toEqual(['b', 'a']);
  });
});

describe('demoTodos', () => {
  it('produces valid tasks with distinct ids and continuing order', () => {
    const today = dayjs('2026-11-20');
    const demo = demoTodos(today, 5);
    expect(demo.length).toBeGreaterThan(0);
    expect(new Set(demo.map((t) => t.id)).size).toBe(demo.length);
    expect(demo.map((t) => t.order)).toEqual(demo.map((_, i) => 5 + i));
    for (const t of demo) {
      expect(validateTodoInput(t)).toBeNull();
      expect(sanitizeTodo(t, 0)).toEqual(t); // survives a storage round trip as is
    }
    // Something overdue and something due today, so those features show.
    expect(demo.some((t) => !t.completed && t.dueDate! < '2026-11-20')).toBe(true);
    expect(demo.some((t) => t.dueDate === '2026-11-20')).toBe(true);
  });
});
