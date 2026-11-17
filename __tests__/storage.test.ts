import { describe, expect, it } from 'vitest';
import { CURRENT_VERSION, migrate, sanitizeTodo } from '@/lib/storage';

const good = {
  id: 'a',
  description: 'Task',
  category: 'Work',
  dueDate: '2026-11-20',
  completed: false,
  order: 0,
  createdAt: '2026-11-19T00:00:00.000Z',
  updatedAt: '2026-11-19T00:00:00.000Z',
};

describe('migrate', () => {
  it('accepts valid v1 data unchanged', () => {
    const data = { version: 1, todos: [good], prefs: { pageSize: 20, view: 'list' } };
    expect(migrate(data)).toEqual({ state: data, dropped: 0 });
  });

  it('returns null for unrecognisable data so the caller can back it up', () => {
    expect(migrate(null)).toBeNull();
    expect(migrate('text')).toBeNull();
    expect(migrate({ todos: [] })).toBeNull(); // no version
    expect(migrate({ version: 1, todos: 'nope' })).toBeNull();
    expect(migrate({ version: CURRENT_VERSION + 1, todos: [] })).toBeNull(); // from a newer app
  });

  it('drops unusable and duplicate tasks and counts them', () => {
    const result = migrate({
      version: 1,
      todos: [good, { ...good }, { id: 'b' }, 'junk', { ...good, id: 'c', description: '  ' }],
      prefs: {},
    });
    expect(result?.state.todos.map((t) => t.id)).toEqual(['a']);
    expect(result?.dropped).toBe(4);
  });

  it('repairs invalid prefs with defaults', () => {
    const result = migrate({ version: 1, todos: [], prefs: { pageSize: 7, view: 'grid' } });
    expect(result?.state.prefs).toEqual({ pageSize: 10, view: 'list' });
  });
});

describe('sanitizeTodo', () => {
  it('repairs fixable fields instead of dropping the task', () => {
    const todo = sanitizeTodo(
      { ...good, category: 'Errands', dueDate: '2026-02-31', completed: 'yes', order: 'x', updatedAt: undefined },
      7,
    );
    expect(todo).toMatchObject({
      category: 'Personal',
      dueDate: null,
      completed: false,
      order: 7,
      updatedAt: good.createdAt,
    });
  });
});
