export type Category = 'Work' | 'Personal' | 'Urgent';
export const CATEGORIES: Category[] = ['Work', 'Personal', 'Urgent'];

export type PageSize = 5 | 10 | 15 | 20;
export type ViewMode = 'list' | 'calendar';

export interface Todo {
  id: string; // crypto.randomUUID()
  description: string; // the task text; the brief's search targets "task description"
  category: Category;
  dueDate: string | null; // 'YYYY-MM-DD' (date only, avoids time-zone drift)
  completed: boolean;
  order: number; // manual position, used for drag-and-drop
  createdAt: string; // ISO timestamp
  updatedAt: string;
}

export interface PersistedState {
  version: 1; // schema version, for future migrations
  todos: Todo[];
  prefs: { pageSize: PageSize; view: ViewMode };
}

/** Fields a user supplies when creating a task; the rest are generated. */
export interface NewTodoInput {
  description: string;
  category: Category;
  dueDate: string | null;
}
