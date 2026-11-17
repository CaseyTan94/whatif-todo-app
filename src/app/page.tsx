'use client';

import { Card, Divider, Skeleton, Typography } from 'antd';
import AddTodo from '@/components/AddTodo';
import TodoList from '@/components/TodoList';
import { TodosProvider, useTodos } from '@/hooks/useTodos';

function TodoApp() {
  const { hydrated } = useTodos();

  // Hydration guard: render a skeleton until localStorage has loaded on the client.
  if (!hydrated) return <Skeleton active paragraph={{ rows: 5 }} />;

  return (
    <>
      <AddTodo />
      <Divider style={{ margin: '16px 0 0' }} />
      <TodoList />
    </>
  );
}

export default function Home() {
  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: '32px 16px' }}>
      <Typography.Title level={2}>To-Do List</Typography.Title>
      <Card>
        <TodosProvider>
          <TodoApp />
        </TodosProvider>
      </Card>
    </main>
  );
}
