'use client';

import { useState } from 'react';
import { App, Form, Modal } from 'antd';
import { useTodos } from '@/hooks/useTodos';
import type { Todo } from '@/types/todo';
import { TodoFormFields, fromTodo, toInput, type TodoFormValues } from './TodoFormFields';

interface EditTodoProps {
  /** The task being edited, or null when the modal is closed. */
  todo: Todo | null;
  onClose: () => void;
}

export default function EditTodo({ todo, onClose }: EditTodoProps) {
  const { updateTodo } = useTodos();
  const { message } = App.useApp();
  const [form] = Form.useForm<TodoFormValues>();

  // Remember the last task shown so the form stays visible during the close animation.
  const [shown, setShown] = useState<Todo | null>(todo);
  if (todo && todo !== shown) setShown(todo);

  function handleFinish(values: TodoFormValues) {
    if (!shown) return;
    const result = updateTodo(shown.id, toInput(values));
    if (!result.ok) {
      message.error(result.error);
      return;
    }
    message.success('Task updated');
    onClose();
  }

  return (
    <Modal
      title="Edit task"
      open={todo !== null}
      okText="Save"
      onOk={() => form.submit()}
      onCancel={onClose}
      // Unmount the form when hidden so the next open starts from that task's values.
      destroyOnHidden
    >
      {shown && (
        <Form<TodoFormValues>
          form={form}
          layout="vertical"
          initialValues={fromTodo(shown)}
          onFinish={handleFinish}
        >
          <TodoFormFields autoFocus />
          {/* Hidden submit so Enter in the description field saves. */}
          <button type="submit" hidden aria-hidden />
        </Form>
      )}
    </Modal>
  );
}
