'use client';

import dayjs from 'dayjs';
import { CalendarOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { App, Badge, Button, Checkbox, Flex, List, Popconfirm, Tag, Tooltip, Typography } from 'antd';
import { useTodos } from '@/hooks/useTodos';
import { CATEGORY_COLORS } from '@/lib/categories';
import { DATE_FORMAT, isOverdue } from '@/lib/validation';
import type { Todo } from '@/types/todo';

interface TodoItemProps {
  todo: Todo;
  today: string; // YYYY-MM-DD, passed in so every row agrees on "today"
  onEdit: (todo: Todo) => void;
}

function TodoItem({ todo, today, onEdit }: TodoItemProps) {
  const { toggleTodo, deleteTodo } = useTodos();
  const { message } = App.useApp();
  const overdue = isOverdue(todo.dueDate, todo.completed, today);

  function handleDelete() {
    deleteTodo(todo.id);
    message.success('Task deleted');
  }

  return (
    <List.Item
      actions={[
        <Tooltip title="Edit" key="edit">
          <Button type="text" icon={<EditOutlined />} aria-label="Edit task" onClick={() => onEdit(todo)} />
        </Tooltip>,
        <Popconfirm
          key="delete"
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
        </Popconfirm>,
      ]}
    >
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
    </List.Item>
  );
}

export default TodoItem;
