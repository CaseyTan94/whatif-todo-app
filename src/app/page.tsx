'use client';

import { useState } from 'react';
import type { Dayjs } from 'dayjs';
import { Button, Card, DatePicker, Empty, Flex, Input, Select, Skeleton, Tag, Typography } from 'antd';
import { useTodos } from '@/hooks/useTodos';
import { CATEGORIES, CATEGORY_COLORS } from '@/lib/categories';
import type { Category } from '@/types/todo';

/**
 * Mon, Nov 16 scaffold: just enough UI to prove add -> save -> reload works.
 * Replaced on Tue by AddTodo / TodoList / TodoItem components.
 */
export default function Home() {
  const { todos, hydrated, addTodo } = useTodos();
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>('Personal');
  const [dueDate, setDueDate] = useState<Dayjs | null>(null);

  const canAdd = description.trim().length > 0;

  function handleAdd() {
    if (!canAdd) return;
    addTodo({
      description,
      category,
      dueDate: dueDate ? dueDate.format('YYYY-MM-DD') : null,
    });
    setDescription('');
    setDueDate(null);
  }

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '32px 16px' }}>
      <Typography.Title level={2}>To-Do List</Typography.Title>

      <Card>
        {!hydrated ? (
          <Skeleton active paragraph={{ rows: 4 }} />
        ) : (
          <Flex vertical gap={16}>
            <Flex gap={8} wrap>
              <Input
                style={{ flex: '1 1 240px' }}
                placeholder="What needs doing?"
                maxLength={200}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onPressEnter={handleAdd}
              />
              <Select<Category>
                style={{ width: 130 }}
                value={category}
                onChange={setCategory}
                options={CATEGORIES.map((c) => ({ value: c, label: c }))}
              />
              <DatePicker value={dueDate} onChange={setDueDate} placeholder="Due date" />
              <Button type="primary" onClick={handleAdd} disabled={!canAdd}>
                Add
              </Button>
            </Flex>

            {todos.length === 0 ? (
              <Empty description="No tasks yet. Add one above." />
            ) : (
              <Flex vertical gap={8} component="ul" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {todos.map((t) => (
                  <Flex key={t.id} component="li" gap={8} align="center">
                    <Tag color={CATEGORY_COLORS[t.category]}>{t.category}</Tag>
                    <Typography.Text style={{ flex: 1 }}>{t.description}</Typography.Text>
                    {t.dueDate && <Typography.Text type="secondary">{t.dueDate}</Typography.Text>}
                  </Flex>
                ))}
              </Flex>
            )}
          </Flex>
        )}
      </Card>
    </main>
  );
}
