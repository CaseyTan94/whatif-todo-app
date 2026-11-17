'use client';

import { useCallback, useMemo, useState, type MouseEvent } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import { Badge, Calendar, Empty, Flex, Grid, Popover, Typography } from 'antd';
import type { CalendarProps } from 'antd';
import { useTodos } from '@/hooks/useTodos';
import { CATEGORIES, CATEGORY_COLORS } from '@/lib/categories';
import { groupByDueDate } from '@/lib/query';
import { DATE_FORMAT } from '@/lib/validation';
import type { Todo } from '@/types/todo';
import EditTodo from './EditTodo';

const MAX_PER_CELL = 3;

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** A task chip: category-coloured dot + description. Click (or Enter) opens the editor. */
function TaskChip({ todo, onOpen }: { todo: Todo; onOpen: (todo: Todo) => void }) {
  return (
    <button
      type="button"
      className="calendar-task"
      data-completed={todo.completed || undefined}
      title={`${todo.description} (${todo.category}${todo.completed ? ', completed' : ''})`}
      onClick={(e) => {
        e.stopPropagation(); // don't also select the calendar cell
        onOpen(todo);
      }}
    >
      <Badge color={CATEGORY_COLORS[todo.category]} />
      <span className="calendar-task-text">{todo.description}</span>
    </button>
  );
}

/**
 * Month calendar of tasks on their due dates, colour-coded by category.
 * Uses antd's built-in Calendar: no extra dependency, and it matches the rest
 * of the UI. Wide screens show tasks in each cell; narrow screens get the
 * compact calendar with a dot per busy day. Either way, the selected day's
 * tasks are listed underneath.
 */
export default function TodoCalendar() {
  const { todos } = useTodos();
  const screens = Grid.useBreakpoint();
  const fullscreen = screens.md !== false; // treat "not measured yet" as wide
  const [selected, setSelected] = useState<Dayjs>(() => dayjs());
  const [editingId, setEditingId] = useState<string | null>(null);

  const byDate = useMemo(() => groupByDueDate(todos), [todos]);
  const byMonth = useMemo(() => {
    const counts = new Map<string, number>();
    for (const [date, list] of byDate) counts.set(date.slice(0, 7), (counts.get(date.slice(0, 7)) ?? 0) + list.length);
    return counts;
  }, [byDate]);
  const undated = todos.filter((t) => !t.dueDate).length;

  const editing = editingId ? (todos.find((t) => t.id === editingId) ?? null) : null;
  const open = useCallback((todo: Todo) => setEditingId(todo.id), []);
  const stop = (e: MouseEvent) => e.stopPropagation();

  const cellRender: CalendarProps<Dayjs>['cellRender'] = (current, info) => {
    if (info.type === 'month') {
      // Year view: how many tasks fall in each month.
      const count = byMonth.get(current.format('YYYY-MM'));
      return count ? <Typography.Text type="secondary">{plural(count, 'task')}</Typography.Text> : null;
    }
    if (info.type !== 'date') return info.originNode;

    const tasks = byDate.get(current.format(DATE_FORMAT));
    if (!tasks) return null;
    if (!fullscreen) return <span className="calendar-mini-dot" aria-hidden />;

    const hidden = tasks.length - MAX_PER_CELL;
    return (
      <div className="calendar-cell">
        {tasks.slice(0, MAX_PER_CELL).map((t) => (
          <TaskChip key={t.id} todo={t} onOpen={open} />
        ))}
        {hidden > 0 && (
          <Popover
            trigger="click"
            title={current.format('ddd, D MMM YYYY')}
            content={
              <Flex vertical style={{ width: 240 }}>
                {tasks.map((t) => (
                  <TaskChip key={t.id} todo={t} onOpen={open} />
                ))}
              </Flex>
            }
          >
            <button type="button" className="calendar-more" onClick={stop}>
              +{hidden} more
            </button>
          </Popover>
        )}
      </div>
    );
  };

  const dayTasks = byDate.get(selected.format(DATE_FORMAT)) ?? [];

  return (
    <>
      <Flex gap={16} wrap align="center" style={{ marginBottom: 8 }} role="group" aria-label="Legend">
        {CATEGORIES.map((c) => (
          <Badge key={c} color={CATEGORY_COLORS[c]} text={c} />
        ))}
        <Typography.Text type="secondary" delete>
          Completed
        </Typography.Text>
        {undated > 0 && (
          <Typography.Text type="secondary">
            {plural(undated, 'task')} without a due date {undated === 1 ? 'is' : 'are'} only in the list.
          </Typography.Text>
        )}
      </Flex>

      <Calendar
        fullscreen={fullscreen}
        value={selected}
        onChange={setSelected}
        cellRender={cellRender}
      />

      <section aria-live="polite" style={{ marginTop: 16 }}>
        <Typography.Title level={5} style={{ marginTop: 0 }}>
          Due {selected.format('ddd, D MMM YYYY')}
        </Typography.Title>
        {dayTasks.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nothing due this day." />
        ) : (
          <Flex vertical gap={2}>
            {dayTasks.map((t) => (
              <TaskChip key={t.id} todo={t} onOpen={open} />
            ))}
          </Flex>
        )}
      </section>

      <EditTodo todo={editing} onClose={() => setEditingId(null)} />
    </>
  );
}
