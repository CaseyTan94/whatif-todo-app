import type { Todo } from '@/types/todo';

function hasDuplicateOrders(todos: Todo[]): boolean {
  return new Set(todos.map((t) => t.order)).size !== todos.length;
}

/** Renumber 0..n-1 in current manual order (stable, so ties keep their array order). */
function renumber(todos: Todo[]): Todo[] {
  const rank = new Map(
    [...todos].sort((a, b) => a.order - b.order).map((t, i) => [t.id, i]),
  );
  return todos.map((t) => (rank.get(t.id) === t.order ? t : { ...t, order: rank.get(t.id)! }));
}

/**
 * Drag-and-drop reorder: move `fromId` into `toId`'s position among the
 * visible tasks (the current page, in manual order).
 *
 * Only the visible tasks change. They hand their existing `order` values
 * around among themselves, so tasks hidden by a search, a filter or on another
 * page keep their place. Returns the same array if nothing moves.
 */
export function reorderTodos(
  todos: Todo[],
  visibleIds: string[],
  fromId: string,
  toId: string,
): Todo[] {
  if (fromId === toId) return todos;
  const from = visibleIds.indexOf(fromId);
  const to = visibleIds.indexOf(toId);
  if (from < 0 || to < 0) return todos;

  // Duplicate order values (e.g. hand-edited storage) would make the swap
  // ambiguous, so give everyone a distinct position first.
  const base = hasDuplicateOrders(todos) ? renumber(todos) : todos;
  const byId = new Map(base.map((t) => [t.id, t]));
  if (visibleIds.some((id) => !byId.has(id))) return todos;

  // The positions the visible tasks occupy, smallest first...
  const slots = visibleIds.map((id) => byId.get(id)!.order).sort((a, b) => a - b);
  // ...handed out again in the new sequence.
  const sequence = [...visibleIds];
  sequence.splice(to, 0, sequence.splice(from, 1)[0]);
  const next = new Map(sequence.map((id, i) => [id, slots[i]]));

  return base.map((t) => {
    const order = next.get(t.id);
    return order === undefined || order === t.order ? t : { ...t, order };
  });
}
