'use client';

import { useCallback, useMemo, useState } from 'react';
import { Empty, List } from 'antd';
import { useTodos } from '@/hooks/useTodos';
import { todayString } from '@/lib/validation';
import type { Todo } from '@/types/todo';
import EditTodo from './EditTodo';
import TodoItem from './TodoItem';

export default function TodoList() {
  const { todos } = useTodos();
  const [editingId, setEditingId] = useState<string | null>(null);

  // Manual order for now; Wed replaces this with the search/filter/sort/paginate pipeline.
  const items = useMemo(() => [...todos].sort((a, b) => a.order - b.order), [todos]);
  const today = todayString();

  // Look up by id so the modal always edits the current version of the task.
  const editing = editingId ? (todos.find((t) => t.id === editingId) ?? null) : null;
  const handleEdit = useCallback((todo: Todo) => setEditingId(todo.id), []);
  const handleClose = useCallback(() => setEditingId(null), []);

  return (
    <>
      <List
        dataSource={items}
        rowKey="id"
        locale={{
          emptyText: <Empty description="No tasks yet. Add one above." />,
        }}
        renderItem={(todo) => <TodoItem todo={todo} today={today} onEdit={handleEdit} />}
      />
      <EditTodo todo={editing} onClose={handleClose} />
    </>
  );
}
