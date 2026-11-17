'use client';

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';
import { App } from 'antd';
import type { NewTodoInput, PersistedState, Todo } from '@/types/todo';
import { emptyState, load, save } from '@/lib/storage';
import { validateTodoInput } from '@/lib/validation';
import { DEFAULT_QUERY, PAGE_SIZES, runQuery, updateQuery, type TodoQuery } from '@/lib/query';

// IMPORT and REORDER land Thu/Fri.
type Action =
  | { type: 'HYDRATE'; state: PersistedState }
  | { type: 'ADD'; todo: Todo }
  | { type: 'UPDATE'; id: string; changes: NewTodoInput; now: string }
  | { type: 'DELETE'; id: string }
  | { type: 'TOGGLE'; id: string; now: string }
  | { type: 'SET_QUERY'; patch: Partial<TodoQuery> };

interface State {
  data: PersistedState; // persisted to localStorage
  query: TodoQuery; // in-memory view state; only pageSize is persisted (via prefs)
  hydrated: boolean; // false until localStorage has been read on the client
}

function mapTodos(state: State, fn: (todos: Todo[]) => Todo[]): State {
  return { ...state, data: { ...state.data, todos: fn(state.data.todos) } };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'HYDRATE': {
      const saved = action.state.prefs.pageSize;
      const pageSize = PAGE_SIZES.includes(saved) ? saved : DEFAULT_QUERY.pageSize;
      return {
        data: { ...action.state, prefs: { ...action.state.prefs, pageSize } },
        query: { ...state.query, pageSize },
        hydrated: true,
      };
    }
    case 'SET_QUERY': {
      const query = updateQuery(state.query, action.patch);
      if (query.pageSize === state.data.prefs.pageSize) return { ...state, query };
      // Page size is a user preference: write it to prefs so it survives reloads.
      return {
        ...state,
        query,
        data: { ...state.data, prefs: { ...state.data.prefs, pageSize: query.pageSize } },
      };
    }
    case 'ADD':
      return mapTodos(state, (todos) => [...todos, action.todo]);
    case 'UPDATE':
      return mapTodos(state, (todos) =>
        todos.map((t) =>
          t.id === action.id ? { ...t, ...action.changes, updatedAt: action.now } : t,
        ),
      );
    case 'DELETE':
      return mapTodos(state, (todos) => todos.filter((t) => t.id !== action.id));
    case 'TOGGLE':
      return mapTodos(state, (todos) =>
        todos.map((t) =>
          t.id === action.id ? { ...t, completed: !t.completed, updatedAt: action.now } : t,
        ),
      );
  }
}

function newId(): string {
  // randomUUID needs a secure context (https or localhost); fall back elsewhere.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalize(input: NewTodoInput): NewTodoInput {
  return { ...input, description: input.description.trim().replace(/\s+/g, ' ') };
}

/** Result of a mutating action: callers show a toast based on it. */
export type ActionResult = { ok: true } | { ok: false; error: string };

function useTodosState() {
  const { notification } = App.useApp();
  const [state, dispatch] = useReducer(reducer, undefined, (): State => ({
    data: emptyState(),
    query: DEFAULT_QUERY,
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

  const { todos } = state.data;

  const addTodo = useCallback(
    (input: NewTodoInput): ActionResult => {
      const clean = normalize(input);
      const error = validateTodoInput(clean);
      if (error) return { ok: false, error };
      const now = new Date().toISOString();
      const order = todos.reduce((max, t) => Math.max(max, t.order), -1) + 1;
      dispatch({
        type: 'ADD',
        todo: { id: newId(), ...clean, completed: false, order, createdAt: now, updatedAt: now },
      });
      return { ok: true };
    },
    [todos],
  );

  const updateTodo = useCallback(
    (id: string, changes: NewTodoInput): ActionResult => {
      const clean = normalize(changes);
      const error = validateTodoInput(clean);
      if (error) return { ok: false, error };
      if (!todos.some((t) => t.id === id)) return { ok: false, error: 'Task no longer exists.' };
      dispatch({ type: 'UPDATE', id, changes: clean, now: new Date().toISOString() });
      return { ok: true };
    },
    [todos],
  );

  const deleteTodo = useCallback((id: string) => dispatch({ type: 'DELETE', id }), []);

  const toggleTodo = useCallback(
    (id: string) => dispatch({ type: 'TOGGLE', id, now: new Date().toISOString() }),
    [],
  );

  const { query } = state;
  const view = useMemo(() => runQuery(todos, query), [todos, query]);

  // Keep the stored page in step with the clamped one. Otherwise, after deleting
  // the last item on page 3, the view shows page 2 but adding a task would jump
  // back to page 3. (Adjusting state during render is React's documented
  // alternative to an effect; it re-renders once and then the pages agree.)
  if (state.hydrated && view.page !== query.page) {
    dispatch({ type: 'SET_QUERY', patch: { page: view.page } });
  }

  const setQuery = useCallback(
    (patch: Partial<TodoQuery>) => dispatch({ type: 'SET_QUERY', patch }),
    [],
  );

  return useMemo(
    () => ({
      todos,
      view,
      query,
      setQuery,
      prefs: state.data.prefs,
      hydrated: state.hydrated,
      addTodo,
      updateTodo,
      deleteTodo,
      toggleTodo,
    }),
    [todos, view, query, setQuery, state.data.prefs, state.hydrated, addTodo, updateTodo, deleteTodo, toggleTodo],
  );
}

export type TodosApi = ReturnType<typeof useTodosState>;

const TodosContext = createContext<TodosApi | null>(null);

/** Owns the single todo store; every component reads it through useTodos(). */
export function TodosProvider({ children }: { children: ReactNode }) {
  const value = useTodosState();
  return createElement(TodosContext.Provider, { value }, children);
}

export function useTodos(): TodosApi {
  const ctx = useContext(TodosContext);
  if (!ctx) throw new Error('useTodos must be used inside <TodosProvider>.');
  return ctx;
}
