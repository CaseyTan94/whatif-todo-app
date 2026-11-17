'use client';

import { PlusOutlined } from '@ant-design/icons';
import { App, Button, Flex, Form } from 'antd';
import { useTodos } from '@/hooks/useTodos';
import { DEFAULT_FORM_VALUES, TodoFormFields, toInput, type TodoFormValues } from './TodoFormFields';

export default function AddTodo() {
  const { addTodo } = useTodos();
  const { message } = App.useApp();
  const [form] = Form.useForm<TodoFormValues>();

  function handleFinish(values: TodoFormValues) {
    const result = addTodo(toInput(values));
    if (!result.ok) {
      message.error(result.error);
      return;
    }
    message.success('Task added');
    // Keep the chosen category: people often add several tasks of one kind in a row.
    form.setFieldsValue({ description: '', dueDate: null });
    form.focusField('description');
  }

  return (
    <Form<TodoFormValues>
      form={form}
      layout="inline"
      initialValues={DEFAULT_FORM_VALUES}
      onFinish={handleFinish}
      aria-label="Add a task"
    >
      {/* Pressing Enter in the description input submits the form (native form behaviour). */}
      <Flex gap={8} wrap style={{ width: '100%' }}>
        <TodoFormFields compact />
        <Form.Item style={{ marginInlineEnd: 0 }}>
          <Button type="primary" htmlType="submit" icon={<PlusOutlined />}>
            Add
          </Button>
        </Form.Item>
      </Flex>
    </Form>
  );
}
