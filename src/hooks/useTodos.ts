'use client';

import { useCallback, useEffect, useReducer } from 'react';
import { App } from 'antd';
import type { NewTodoInput, PersistedState, Todo } from '@/types/todo';
import { emptyState, load, save } from '@/lib/storage';

// Mon scope: HYDRATE + ADD. UPDATE, DELETE, TOGGLE, IMPORT, REORDER land Tue-Fri.
type Action =
  | { type: 'HYDRATE'; state: PersistedState }
  | { type: 'ADD'; todo: Todo };

interface State {
  data: PersistedState;
  hydrated: boolean; // false until localStorage has been read on the client
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'HYDRATE':
      return { data: action.state, hydrated: true };
    case 'ADD':
      return {
        ...state,
        data: { ...state.data, todos: [...state.data.todos, action.todo] },
      };
  }
}

function newId(): string {
  // randomUUID needs a secure context (https or localhost); fall back elsewhere.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function useTodos() {
  const { notification } = App.useApp();
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    data: emptyState(),
    hydrated: false,
  }));

  // 1. Load once on the client. localStorage doesn't exist on the server, so
  //    this must run in an effect, never during render.
  useEffect(() => {
    dispatch({ type: 'HYDRATE', state: load() });
  }, []);

  // 2. Save on every change, but ONLY after hydration. Saving before load would
  //    overwrite the user's stored tasks with the initial empty list.
  useEffect(() => {
    if (!state.hydrated) return;
    const result = save(state.data);
    if (!result.ok) {
      console.error('[storage] Save failed', result.error);
      notification.error({
        key: 'storage-save-failed', // de-duplicates repeated failures
        title: 'Could not save your tasks',
        description:
          'Browser storage is full or blocked. Changes will be lost when you close this tab.',
      });
    }
  }, [state.data, state.hydrated, notification]);

  const addTodo = useCallback(
    (input: NewTodoInput) => {
      const now = new Date().toISOString();
      const order = state.data.todos.reduce((max, t) => Math.max(max, t.order), -1) + 1;
      dispatch({
        type: 'ADD',
        todo: {
          id: newId(),
          description: input.description.trim(),
          category: input.category,
          dueDate: input.dueDate,
          completed: false,
          order,
          createdAt: now,
          updatedAt: now,
        },
      });
    },
    [state.data.todos],
  );

  return {
    todos: state.data.todos,
    prefs: state.data.prefs,
    hydrated: state.hydrated,
    addTodo,
  };
}
