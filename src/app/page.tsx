'use client';

import { Card, Divider, Flex, Skeleton, Typography } from 'antd';
import AddTodo from '@/components/AddTodo';
import ExportButton from '@/components/ExportButton';
import Filters from '@/components/Filters';
import ImportTodos from '@/components/ImportTodos';
import TodoList from '@/components/TodoList';
import { TodosProvider, useTodos } from '@/hooks/useTodos';

function TodoApp() {
  const { hydrated } = useTodos();

  // Hydration guard: render a skeleton until localStorage has loaded on the client.
  if (!hydrated) return <Skeleton active paragraph={{ rows: 5 }} />;

  return (
    <>
      <Flex justify="flex-end" gap={8} wrap style={{ marginBottom: 16 }}>
        <ImportTodos />
        <ExportButton />
      </Flex>
      <AddTodo />
      <Divider style={{ margin: '16px 0' }} />
      <Filters />
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
