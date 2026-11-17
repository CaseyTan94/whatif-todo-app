// @vitest-environment jsdom
import { createElement, type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { App } from 'antd';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TodosProvider, useTodos } from '@/hooks/useTodos';
import { STORAGE_KEY } from '@/lib/storage';
import type { PersistedState, Todo } from '@/types/todo';

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(App, null, createElement(TodosProvider, null, children));

function todo(id: string, order: number): Todo {
  return {
    id,
    description: `Task ${id}`,
    category: 'Work',
    dueDate: null,
    completed: false,
    order,
    createdAt: '2026-11-20T00:00:00.000Z',
    updatedAt: '2026-11-20T00:00:00.000Z',
  };
}

function store(todos: Todo[]) {
  const state: PersistedState = { version: 1, todos, prefs: { pageSize: 10, view: 'list' } };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function stored(): PersistedState {
  return JSON.parse(localStorage.getItem(STORAGE_KEY)!);
}

async function renderTodos() {
  const hook = renderHook(() => useTodos(), { wrapper });
  await waitFor(() => expect(hook.result.current.hydrated).toBe(true));
  return hook;
}

beforeEach(() => {
  // antd's responsive helpers expect matchMedia, which jsdom lacks.
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
});

afterEach(() => localStorage.clear());

describe('useTodos', () => {
  it('loads saved tasks without overwriting them first (hydration guard)', async () => {
    store([todo('a', 0), todo('b', 1)]);
    const { result } = await renderTodos();
    expect(result.current.todos.map((t) => t.id)).toEqual(['a', 'b']);
    expect(stored().todos).toHaveLength(2);
  });

  it('seeds sample tasks on the very first visit and saves them', async () => {
    const { result } = await renderTodos();
    expect(result.current.todos.length).toBeGreaterThan(0);
    await waitFor(() => expect(stored().todos).toHaveLength(result.current.todos.length));
  });

  it('does not re-seed after the user clears everything', async () => {
    store([]);
    const { result } = await renderTodos();
    expect(result.current.todos).toEqual([]);
  });

  it('reorders only in manual order, and saves the new order', async () => {
    store([todo('a', 0), todo('b', 1), todo('c', 2)]);
    const { result } = await renderTodos();

    act(() => result.current.reorder('c', 'a')); // ignored: sorted by due date
    expect(result.current.view.items.map((t) => t.id)).toEqual(['a', 'b', 'c']);

    act(() => result.current.setQuery({ sortDir: 'manual' }));
    act(() => result.current.reorder('c', 'a'));
    expect(result.current.view.items.map((t) => t.id)).toEqual(['c', 'a', 'b']);
    await waitFor(() =>
      expect(stored().todos.sort((x, y) => x.order - y.order).map((t) => t.id)).toEqual(['c', 'a', 'b']),
    );
  });

  it('remembers the List/Calendar choice', async () => {
    store([]);
    const { result } = await renderTodos();
    act(() => result.current.setView('calendar'));
    await waitFor(() => expect(stored().prefs.view).toBe('calendar'));
  });

  it('clears all tasks', async () => {
    store([todo('a', 0)]);
    const { result } = await renderTodos();
    act(() => result.current.clearAll());
    await waitFor(() => expect(stored().todos).toEqual([]));
  });
});
