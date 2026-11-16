import type { PersistedState } from '@/types/todo';

/**
 * localStorage adapter. All access to the browser store goes through here so
 * the rest of the app never touches `window.localStorage` directly, and the
 * backend could later be swapped (e.g. IndexedDB) without touching callers.
 *
 * These functions must only be called on the client (inside effects or event
 * handlers). localStorage does not exist during server rendering.
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

/**
 * Bring older or unknown data up to the current schema. Only v1 exists today,
 * so anything that isn't a recognisable v1 object falls back to empty state.
 * Future versions add a step here (v1 -> v2 -> ...).
 */
export function migrate(raw: unknown): PersistedState {
  if (!raw || typeof raw !== 'object') return emptyState();
  const data = raw as Partial<PersistedState> & { version?: unknown };

  if (data.version === CURRENT_VERSION && Array.isArray(data.todos)) {
    const defaults = emptyState().prefs;
    return {
      version: CURRENT_VERSION,
      todos: data.todos,
      prefs: { ...defaults, ...(data.prefs ?? {}) },
    };
  }

  console.warn(
    `[storage] Unrecognised data (version ${String(data.version)}); starting fresh.`,
  );
  return emptyState();
}

export function load(): PersistedState {
  try {
    const text = window.localStorage.getItem(STORAGE_KEY);
    if (text === null) return emptyState();
    return migrate(JSON.parse(text));
  } catch (err) {
    console.warn('[storage] Could not read saved tasks; starting fresh.', err);
    return emptyState();
  }
}

export type SaveResult = { ok: true } | { ok: false; error: unknown };

/** Never throws. A full or blocked store returns `{ ok: false }` for the UI to report. */
export function save(state: PersistedState): SaveResult {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}
