'use client';

import { useCallback, useState } from 'react';
import { Empty, Flex, List, Pagination, Typography } from 'antd';
import { useTodos } from '@/hooks/useTodos';
import { PAGE_SIZES, isFiltering } from '@/lib/query';
import { todayString } from '@/lib/validation';
import type { PageSize, Todo } from '@/types/todo';
import EditTodo from './EditTodo';
import TodoItem from './TodoItem';

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export default function TodoList() {
  const { todos, view, query, setQuery } = useTodos();
  const [editingId, setEditingId] = useState<string | null>(null);
  const today = todayString();
  const filtering = isFiltering(query);

  // Look up by id so the modal always edits the current version of the task.
  const editing = editingId ? (todos.find((t) => t.id === editingId) ?? null) : null;
  const handleEdit = useCallback((todo: Todo) => setEditingId(todo.id), []);
  const handleClose = useCallback(() => setEditingId(null), []);

  // e.g. "Page 2 of 5 · 43 tasks" or "Page 1 of 2 · 12 of 43 tasks match"
  const countLabel = filtering
    ? `${view.total} of ${plural(todos.length, 'task')} match`
    : plural(view.total, 'task');

  const emptyText =
    todos.length === 0
      ? 'No tasks yet. Add one above.'
      : 'No tasks match your search or filter.';

  return (
    <>
      <List
        dataSource={view.items}
        rowKey="id"
        locale={{ emptyText: <Empty description={emptyText} /> }}
        renderItem={(todo) => <TodoItem todo={todo} today={today} onEdit={handleEdit} />}
      />

      <Flex justify="space-between" align="center" wrap gap={12} style={{ marginTop: 16 }}>
        <Typography.Text type="secondary" aria-live="polite">
          Page {view.page} of {view.totalPages} · {countLabel}
        </Typography.Text>
        <Pagination
          current={view.page}
          total={view.total}
          pageSize={query.pageSize}
          pageSizeOptions={PAGE_SIZES}
          showSizeChanger // always show, even when there are few tasks
          onChange={(page, pageSize) => {
            if (pageSize !== query.pageSize) setQuery({ pageSize: pageSize as PageSize });
            else setQuery({ page });
          }}
        />
      </Flex>

      <EditTodo todo={editing} onClose={handleClose} />
    </>
  );
}
