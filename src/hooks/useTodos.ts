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
import type { ImportedTodo, NewTodoInput, PersistedState, Todo, ViewMode } from '@/types/todo';
import { demoTodos } from '@/lib/demo';
import { newId } from '@/lib/id';
import { reorderTodos } from '@/lib/reorder';
import { emptyState, load, save, subscribe } from '@/lib/storage';
import { validateTodoInput } from '@/lib/validation';
import { DEFAULT_QUERY, runQuery, updateQuery, type TodoQuery } from '@/lib/query';

type Action =
  | { type: 'HYDRATE'; state: PersistedState } // initial load, and re-load when another tab saves
  | { type: 'ADD'; todo: Todo }
  | { type: 'IMPORT'; todos: Todo[] }
  | { type: 'UPDATE'; id: string; changes: NewTodoInput; now: string }
  | { type: 'DELETE'; id: string }
  | { type: 'TOGGLE'; id: string; now: string }
  | { type: 'REORDER'; visibleIds: string[]; fromId: string; toId: string }
  | { type: 'CLEAR_ALL' }
  | { type: 'SET_VIEW'; view: ViewMode }
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
    case 'HYDRATE':
      // storage.load() has already validated prefs. Keep the current search,
      // filter and sort so a sync from another tab doesn't reset them.
      return {
        data: action.state,
        query: { ...state.query, pageSize: action.state.prefs.pageSize },
        hydrated: true,
      };
    case 'IMPORT':
      return mapTodos(state, (todos) => [...todos, ...action.todos]);
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
    case 'SET_VIEW':
      return { ...state, data: { ...state.data, prefs: { ...state.data.prefs, view: action.view } } };
    case 'ADD':
      return mapTodos(state, (todos) => [...todos, action.todo]);
    case 'REORDER':
      // Position isn't content, so updatedAt is left alone.
      return mapTodos(state, (todos) =>
        reorderTodos(todos, action.visibleIds, action.fromId, action.toId),
      );
    case 'CLEAR_ALL':
      return mapTodos(state, () => []);
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

function normalize(input: NewTodoInput): NewTodoInput {
  return { ...input, description: input.description.trim().replace(/\s+/g, ' ') };
}

/** Result of a mutating action: callers show a toast based on it. */
export type ActionResult = { ok: true } | { ok: false; error: string };

function useTodosState() {
  const { message, notification } = App.useApp();
  const [state, dispatch] = useReducer(reducer, undefined, (): State => ({
    data: emptyState(),
    query: DEFAULT_QUERY,
    hydrated: false,
  }));

  // 1. Load once on the client. localStorage doesn't exist on the server, so
  //    this must run in an effect, never during render.
  useEffect(() => {
    const { state: loaded, recovered, firstRun } = load();
    if (firstRun) {
      // First visit in this browser: start with sample tasks so every feature
      // has something to show. They're saved like any other task.
      dispatch({ type: 'HYDRATE', state: { ...loaded, todos: demoTodos() } });
      message.info({
        key: 'demo-tasks', // Strict Mode runs this effect twice in dev
        content: 'Added some sample tasks to get you started. Use "Clear all" to remove them.',
        duration: 6,
      });
    } else {
      dispatch({ type: 'HYDRATE', state: loaded });
    }
    if (recovered) {
      notification.warning({
        key: 'storage-recovered',
        title: 'Some saved data could not be read',
        description: recovered.backupKey
          ? `Your saved tasks were unreadable, so the list was reset. The original data was kept in localStorage under "${recovered.backupKey}".`
          : `${recovered.dropped} invalid task(s) were skipped.`,
        duration: 0,
      });
    }
    // Keep tabs in sync: when another tab saves, re-load from storage.
    return subscribe(() => dispatch({ type: 'HYDRATE', state: load().state }));
  }, [message, notification]);

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

  /**
   * Append imported rows after the existing tasks. Every row gets a fresh id and
   * continuing `order` values. Rows are expected to be validated already
   * (lib/importer.ts); anything still invalid is skipped. Returns the count added.
   */
  const importTodos = useCallback(
    (rows: ImportedTodo[]): number => {
      const now = new Date().toISOString();
      let order = todos.reduce((max, t) => Math.max(max, t.order), -1);
      const added: Todo[] = [];
      for (const row of rows) {
        const clean = normalize(row);
        if (validateTodoInput(clean)) continue;
        order += 1;
        added.push({ id: newId(), ...clean, completed: row.completed, order, createdAt: now, updatedAt: now });
      }
      if (added.length > 0) dispatch({ type: 'IMPORT', todos: added });
      return added.length;
    },
    [todos],
  );

  /** Append the sample tasks again (offered from the empty state). */
  const loadDemo = useCallback(() => {
    const start = todos.reduce((max, t) => Math.max(max, t.order), -1) + 1;
    dispatch({ type: 'IMPORT', todos: demoTodos(undefined, start) });
  }, [todos]);

  const clearAll = useCallback(() => dispatch({ type: 'CLEAR_ALL' }), []);

  const setView = useCallback((view: ViewMode) => dispatch({ type: 'SET_VIEW', view }), []);

  const { query } = state;
  const view = useMemo(() => runQuery(todos, query), [todos, query]);

  /**
   * Drag-and-drop: move `fromId` to where `toId` is on the current page. Only
   * allowed in manual order, where the list position *is* the order.
   */
  const reorder = useCallback(
    (fromId: string, toId: string) => {
      if (query.sortDir !== 'manual') return;
      dispatch({ type: 'REORDER', visibleIds: view.items.map((t) => t.id), fromId, toId });
    },
    [query.sortDir, view.items],
  );

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
      importTodos,
      reorder,
      clearAll,
      loadDemo,
      setView,
    }),
    [todos, view, query, setQuery, state.data.prefs, state.hydrated, addTodo, updateTodo, deleteTodo, toggleTodo, importTodos, reorder, clearAll, loadDemo, setView],
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
