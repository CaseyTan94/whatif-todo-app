'use client';

import dayjs from 'dayjs';
import type { DraggableProvidedDragHandleProps } from '@hello-pangea/dnd';
import { CalendarOutlined, DeleteOutlined, EditOutlined, HolderOutlined } from '@ant-design/icons';
import { App, Badge, Button, Checkbox, Flex, Popconfirm, Tag, Tooltip, Typography, theme } from 'antd';
import { useTodos } from '@/hooks/useTodos';
import { CATEGORY_COLORS } from '@/lib/categories';
import { DATE_FORMAT, isOverdue } from '@/lib/validation';
import type { Todo } from '@/types/todo';

interface TodoItemProps {
  todo: Todo;
  today: string; // YYYY-MM-DD, passed in so every row agrees on "today"
  onEdit: (todo: Todo) => void;
  /** Present only in manual order: renders the drag handle (mouse, touch and keyboard). */
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
}

/** One task row. The list wraps it in an <li> that drag-and-drop controls. */
function TodoItem({ todo, today, onEdit, dragHandleProps }: TodoItemProps) {
  const { toggleTodo, deleteTodo } = useTodos();
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const overdue = isOverdue(todo.dueDate, todo.completed, today);

  function handleDelete() {
    deleteTodo(todo.id);
    message.success('Task deleted');
  }

  return (
    <Flex align="center" gap={12} style={{ padding: '12px 4px' }}>
      {dragHandleProps && (
        <span
          {...dragHandleProps}
          // Space lifts the row, arrow keys move it, Space drops, Escape cancels.
          aria-label={`Reorder "${todo.description}"`}
          style={{ cursor: 'grab', color: token.colorTextTertiary, padding: '4px 0', display: 'flex' }}
        >
          <HolderOutlined />
        </span>
      )}

      <Flex gap={12} align="center" wrap style={{ flex: 1, minWidth: 0 }}>
        <Checkbox
          checked={todo.completed}
          onChange={() => toggleTodo(todo.id)}
          aria-label={todo.completed ? 'Mark as incomplete' : 'Mark as complete'}
        />
        <Typography.Text
          delete={todo.completed}
          type={todo.completed ? 'secondary' : undefined}
          style={{ flex: '1 1 200px', minWidth: 0, wordBreak: 'break-word' }}
        >
          {todo.description}
        </Typography.Text>
        <Tag color={CATEGORY_COLORS[todo.category]} style={{ marginInlineEnd: 0 }}>
          {todo.category}
        </Tag>
        {todo.dueDate && (
          <Flex gap={6} align="center">
            <Typography.Text type={overdue ? 'danger' : 'secondary'}>
              <CalendarOutlined /> {dayjs(todo.dueDate, DATE_FORMAT).format('D MMM YYYY')}
            </Typography.Text>
            {overdue && <Badge status="error" text="Overdue" />}
          </Flex>
        )}
      </Flex>

      <Flex gap={4}>
        <Tooltip title="Edit">
          <Button type="text" icon={<EditOutlined />} aria-label="Edit task" onClick={() => onEdit(todo)} />
        </Tooltip>
        <Popconfirm
          title="Delete this task?"
          description="This can't be undone."
          okText="Delete"
          okButtonProps={{ danger: true }}
          cancelText="Cancel"
          onConfirm={handleDelete}
        >
          <Tooltip title="Delete">
            <Button type="text" danger icon={<DeleteOutlined />} aria-label="Delete task" />
          </Tooltip>
        </Popconfirm>
      </Flex>
    </Flex>
  );
}

export default TodoItem;
