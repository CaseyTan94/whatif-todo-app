'use client';

import { CalendarOutlined, DeleteOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { App, Button, Card, Divider, Flex, Popconfirm, Skeleton, Tabs, Typography } from 'antd';
import AddTodo from '@/components/AddTodo';
import TodoCalendar from '@/components/Calendar';
import ExportButton from '@/components/ExportButton';
import Filters from '@/components/Filters';
import ImportTodos from '@/components/ImportTodos';
import TodoList from '@/components/TodoList';
import { TodosProvider, useTodos } from '@/hooks/useTodos';
import type { ViewMode } from '@/types/todo';

function ClearAllButton() {
  const { todos, clearAll } = useTodos();
  const { message } = App.useApp();
  const count = todos.length;
  return (
    <Popconfirm
      title={`Delete all ${count} task${count === 1 ? '' : 's'}?`}
      description="This can't be undone. Export first if you want a copy."
      okText="Delete all"
      okButtonProps={{ danger: true }}
      onConfirm={() => {
        clearAll();
        message.success('All tasks deleted');
      }}
      disabled={count === 0}
    >
      <Button danger icon={<DeleteOutlined />} disabled={count === 0}>
        Clear all
      </Button>
    </Popconfirm>
  );
}

function TodoApp() {
  const { hydrated, prefs, setView } = useTodos();

  // Hydration guard: render a skeleton until localStorage has loaded on the client.
  if (!hydrated) return <Skeleton active paragraph={{ rows: 6 }} />;

  return (
    <>
      <Flex justify="flex-end" gap={8} wrap style={{ marginBottom: 16 }}>
        <ImportTodos />
        <ExportButton />
        <ClearAllButton />
      </Flex>
      <AddTodo />
      <Divider style={{ margin: '16px 0 4px' }} />
      <Tabs
        activeKey={prefs.view}
        onChange={(key) => setView(key as ViewMode)}
        items={[
          {
            key: 'list',
            label: 'List',
            icon: <UnorderedListOutlined />,
            children: (
              <>
                <Filters />
                <TodoList />
              </>
            ),
          },
          {
            key: 'calendar',
            label: 'Calendar',
            icon: <CalendarOutlined />,
            children: <TodoCalendar />,
          },
        ]}
      />
    </>
  );
}

export default function Home() {
  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '24px 12px' }}>
      <Typography.Title level={2} style={{ marginTop: 0 }}>
        To-Do List
      </Typography.Title>
      <Card styles={{ body: { padding: 'clamp(12px, 3vw, 24px)' } }}>
        <TodosProvider>
          <TodoApp />
        </TodosProvider>
      </Card>
    </main>
  );
}
