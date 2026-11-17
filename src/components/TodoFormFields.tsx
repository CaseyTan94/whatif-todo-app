'use client';

import dayjs, { type Dayjs } from 'dayjs';
import { DatePicker, Form, Input, Select, Tag } from 'antd';
import { CATEGORIES, CATEGORY_COLORS } from '@/lib/categories';
import { DATE_FORMAT, DESCRIPTION_MAX } from '@/lib/validation';
import type { Category, NewTodoInput, Todo } from '@/types/todo';

/** Shape antd's Form works with (DatePicker needs a Dayjs, not a string). */
export interface TodoFormValues {
  description: string;
  category: Category;
  dueDate: Dayjs | null;
}

export const DEFAULT_FORM_VALUES: TodoFormValues = {
  description: '',
  category: 'Personal',
  dueDate: null,
};

export function toInput(values: TodoFormValues): NewTodoInput {
  return {
    description: values.description ?? '',
    category: values.category,
    dueDate: values.dueDate ? values.dueDate.format(DATE_FORMAT) : null,
  };
}

export function fromTodo(todo: Todo): TodoFormValues {
  return {
    description: todo.description,
    category: todo.category,
    dueDate: todo.dueDate ? dayjs(todo.dueDate, DATE_FORMAT) : null,
  };
}

const categoryOptions = CATEGORIES.map((c) => ({
  value: c,
  label: (
    <Tag color={CATEGORY_COLORS[c]} style={{ marginInlineEnd: 0 }}>
      {c}
    </Tag>
  ),
}));

/**
 * The description / category / due-date fields shared by AddTodo and EditTodo,
 * so both forms validate identically. `compact` hides labels for the inline add bar.
 */
export function TodoFormFields({ compact = false, autoFocus = false }: { compact?: boolean; autoFocus?: boolean }) {
  return (
    <>
      <Form.Item<TodoFormValues>
        name="description"
        label={compact ? undefined : 'Description'}
        style={compact ? { flex: '1 1 260px', marginInlineEnd: 0 } : undefined}
        rules={[
          { required: true, whitespace: true, message: 'Please describe the task.' },
          { max: DESCRIPTION_MAX, message: `Keep it under ${DESCRIPTION_MAX} characters.` },
        ]}
      >
        <Input
          placeholder="What needs doing?"
          maxLength={DESCRIPTION_MAX}
          showCount={!compact}
          autoFocus={autoFocus}
          aria-label="Task description"
        />
      </Form.Item>

      <Form.Item<TodoFormValues>
        name="category"
        label={compact ? undefined : 'Category'}
        style={compact ? { marginInlineEnd: 0 } : undefined}
        rules={[{ required: true, message: 'Pick a category.' }]}
      >
        <Select<Category> options={categoryOptions} style={{ width: 130 }} aria-label="Category" />
      </Form.Item>

      <Form.Item<TodoFormValues>
        name="dueDate"
        label={compact ? undefined : 'Due date'}
        style={compact ? { marginInlineEnd: 0 } : undefined}
      >
        <DatePicker placeholder="Due date" format="D MMM YYYY" aria-label="Due date" />
      </Form.Item>
    </>
  );
}
