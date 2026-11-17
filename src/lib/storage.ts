import type { PersistedState, Todo } from '@/types/todo';
import { isCategory } from '@/lib/categories';
import { PAGE_SIZES } from '@/lib/query';
import { DESCRIPTION_MAX, isValidDateString } from '@/lib/validation';

/**
 * localStorage adapter. All access to the browser store goes through here so
 * the rest of the app never touches `window.localStorage` directly, and the
 * backend could later be swapped (e.g. IndexedDB) without touching callers.
 *
 * load/save/subscribe must only be called on the client (inside effects or
 * event handlers). localStorage does not exist during server rendering.
 */

export const STORAGE_KEY = 'whatif-todos:v1';
export const CURRENT_VERSION = 1 as const;

export function emptyState(): PersistedState {
  return {
    version: CURRENT_VERSION,
    todos: [],
    prefs: { pageSize: 10, view: 'list' },
  };
}

// ---------------------------------------------------------------------------
// Migration and validation (pure)
// ---------------------------------------------------------------------------

/**
 * One step per schema version: MIGRATIONS[n] turns version n data into n + 1.
 * Empty while only v1 exists. When v2 ships, add `1: (d) => ({ ...d, version: 2, ... })`
 * and bump CURRENT_VERSION.
 */
const MIGRATIONS: Record<number, (data: Record<string, unknown>) => Record<string, unknown>> = {};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Returns a valid Todo, repairing what it safely can, or null if the entry is unusable. */
export function sanitizeTodo(raw: unknown, fallbackOrder: number): Todo | null {
  if (!isRecord(raw)) return null;
  const { id, description, category, dueDate, completed, order, createdAt, updatedAt } = raw;

  if (typeof id !== 'string' || id === '') return null;
  if (typeof description !== 'string') return null;
  const text = description.trim();
  if (text === '' || text.length > DESCRIPTION_MAX) return null;

  const now = new Date().toISOString();
  const created = typeof createdAt === 'string' ? createdAt : now;
  return {
    id,
    description: text,
    category: isCategory(category) ? category : 'Personal',
    dueDate: isValidDateString(dueDate) ? dueDate : null,
    completed: completed === true,
    order: typeof order === 'number' && Number.isFinite(order) ? order : fallbackOrder,
    createdAt: created,
    updatedAt: typeof updatedAt === 'string' ? updatedAt : created,
  };
}

export interface MigrateResult {
  state: PersistedState;
  /** Entries that were present but couldn't be repaired, so were dropped. */
  dropped: number;
}

/**
 * Bring stored data up to the current schema and validate every field.
 * Returns null when the data isn't recognisable at all (wrong shape, or a
 * version newer than this app understands), so the caller can back it up.
 */
export function migrate(raw: unknown): MigrateResult | null {
  if (!isRecord(raw) || typeof raw.version !== 'number') return null;

  let data = raw;
  while (typeof data.version === 'number' && data.version < CURRENT_VERSION) {
    const step = MIGRATIONS[data.version];
    if (!step) return null;
    data = step(data);
  }
  if (data.version !== CURRENT_VERSION || !Array.isArray(data.todos)) return null;

  const seen = new Set<string>();
  const todos: Todo[] = [];
  data.todos.forEach((entry, i) => {
    const todo = sanitizeTodo(entry, i);
    if (todo && !seen.has(todo.id)) {
      seen.add(todo.id);
      todos.push(todo);
    }
  });

  const defaults = emptyState().prefs;
  const prefs = isRecord(data.prefs) ? data.prefs : {};
  const pageSize = PAGE_SIZES.find((size) => size === prefs.pageSize) ?? defaults.pageSize;
  const view = prefs.view === 'calendar' || prefs.view === 'list' ? prefs.view : defaults.view;

  return {
    state: { version: CURRENT_VERSION, todos, prefs: { pageSize, view } },
    dropped: data.todos.length - todos.length,
  };
}

// ---------------------------------------------------------------------------
// Browser access
// ---------------------------------------------------------------------------

export interface LoadResult {
  state: PersistedState;
  /** Set when stored data had problems, so the UI can tell the user. */
  recovered?: { dropped: number; backupKey?: string };
  /** True when nothing has ever been saved in this browser (first visit). */
  firstRun?: boolean;
}

/** Copy unreadable data aside before it gets overwritten, so nothing is silently lost. */
function backUp(text: string): string | undefined {
  const key = `${STORAGE_KEY}:backup:${new Date().toISOString()}`;
  try {
    window.localStorage.setItem(key, text);
    return key;
  } catch {
    return undefined; // storage full: nothing more we can do
  }
}

export function load(): LoadResult {
  let text: string | null;
  try {
    text = window.localStorage.getItem(STORAGE_KEY);
  } catch (err) {
    // Storage blocked (e.g. some privacy modes). Run in memory; save() will report.
    console.warn('[storage] localStorage is unavailable.', err);
    return { state: emptyState() };
  }
  if (text === null) return { state: emptyState(), firstRun: true };

  let result: MigrateResult | null = null;
  try {
    result = migrate(JSON.parse(text));
  } catch {
    result = null; // not valid JSON
  }

  if (!result) {
    const backupKey = backUp(text);
    console.warn(`[storage] Saved data was unreadable; backed up to "${backupKey}" and starting fresh.`);
    return { state: emptyState(), recovered: { dropped: 0, backupKey } };
  }
  if (result.dropped > 0) {
    console.warn(`[storage] Dropped ${result.dropped} invalid task(s) from saved data.`);
    return { state: result.state, recovered: { dropped: result.dropped } };
  }
  return { state: result.state };
}

export type SaveResult = { ok: true } | { ok: false; error: unknown };

/** Never throws. A full or blocked store returns `{ ok: false }` for the UI to report. */
export function save(state: PersistedState): SaveResult {
  try {
    const text = JSON.stringify(state);
    // Skip identical writes. This also stops two tabs echoing a sync back and forth.
    if (window.localStorage.getItem(STORAGE_KEY) !== text) {
      window.localStorage.setItem(STORAGE_KEY, text);
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

/**
 * Cross-tab sync: calls `onChange` when another tab writes our key (the
 * `storage` event never fires in the tab that made the change).
 * Returns an unsubscribe function.
 */
export function subscribe(onChange: () => void): () => void {
  const handler = (event: StorageEvent) => {
    // key is null when another tab calls localStorage.clear()
    if (event.key === STORAGE_KEY || event.key === null) onChange();
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}
