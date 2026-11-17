'use client';

import { useCallback, useState } from 'react';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { Button, Empty, Flex, Pagination, Typography, theme } from 'antd';
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
  const { todos, view, query, setQuery, reorder, loadDemo } = useTodos();
  const { token } = theme.useToken();
  const [editingId, setEditingId] = useState<string | null>(null);
  const today = todayString();
  const filtering = isFiltering(query);
  const manual = query.sortDir === 'manual';

  // Look up by id so the modal always edits the current version of the task.
  const editing = editingId ? (todos.find((t) => t.id === editingId) ?? null) : null;
  const handleEdit = useCallback((todo: Todo) => setEditingId(todo.id), []);
  const handleClose = useCallback(() => setEditingId(null), []);

  const handleDragEnd = useCallback(
    ({ draggableId, source, destination }: DropResult) => {
      if (!destination || destination.index === source.index) return;
      const target = view.items[destination.index];
      if (target) reorder(draggableId, target.id);
    },
    [view.items, reorder],
  );

  // e.g. "Page 2 of 5 · 43 tasks" or "Page 1 of 2 · 12 of 43 tasks match"
  const countLabel = filtering
    ? `${view.total} of ${plural(todos.length, 'task')} match`
    : plural(view.total, 'task');

  // Drag-and-drop only makes sense when list position is the order.
  let dragHint: string | null = null;
  if (view.items.length > 1) {
    if (!manual) dragHint = 'Switch to Manual order to drag tasks into place.';
    else if (filtering || view.totalPages > 1) dragHint = 'Dragging reorders tasks on this page only.';
  }

  return (
    <>
      {dragHint && (
        <Typography.Text type="secondary" style={{ display: 'block', fontSize: token.fontSizeSM, marginBottom: 4 }}>
          <InfoCircleOutlined /> {dragHint}
        </Typography.Text>
      )}

      {view.items.length === 0 ? (
        <Empty
          style={{ margin: '32px 0' }}
          description={
            todos.length === 0
              ? 'No tasks yet. Add one above or import a CSV.'
              : 'No tasks match your search or filter.'
          }
        >
          {todos.length === 0 && <Button onClick={loadDemo}>Load sample tasks</Button>}
        </Empty>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="todo-list" isDropDisabled={!manual}>
            {(drop) => (
              <ul
                ref={drop.innerRef}
                {...drop.droppableProps}
                aria-label="Tasks"
                style={{ listStyle: 'none', margin: 0, padding: 0 }}
              >
                {view.items.map((todo, index) => (
                  <Draggable key={todo.id} draggableId={todo.id} index={index} isDragDisabled={!manual}>
                    {(drag, snapshot) => (
                      <li
                        ref={drag.innerRef}
                        {...drag.draggableProps}
                        style={{
                          ...drag.draggableProps.style,
                          borderBottom: `1px solid ${token.colorSplit}`,
                          ...(snapshot.isDragging && {
                            background: token.colorBgElevated,
                            boxShadow: token.boxShadowSecondary,
                            borderRadius: token.borderRadius,
                          }),
                        }}
                      >
                        <TodoItem
                          todo={todo}
                          today={today}
                          onEdit={handleEdit}
                          dragHandleProps={manual ? drag.dragHandleProps : null}
                        />
                      </li>
                    )}
                  </Draggable>
                ))}
                {drop.placeholder}
              </ul>
            )}
          </Droppable>
        </DragDropContext>
      )}

      <Flex justify="space-between" align="center" wrap gap={12} style={{ marginTop: 16 }}>
        <Typography.Text type="secondary" aria-live="polite">
          Page {view.page} of {view.totalPages} · {countLabel}
        </Typography.Text>
        <Pagination
          className="todo-pagination"
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
