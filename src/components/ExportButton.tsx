'use client';

import { useState } from 'react';
import { DownOutlined, FileExcelOutlined } from '@ant-design/icons';
import { App, Button, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { useTodos } from '@/hooks/useTodos';
import { applyFilters } from '@/lib/query';

type ExportScope = 'all' | 'view';

export default function ExportButton() {
  const { todos, query, view } = useTodos();
  const { message } = App.useApp();
  const [busy, setBusy] = useState(false);

  async function handleExport(scope: ExportScope) {
    // "Current view" = every task matching the search/filter, in the current sort,
    // across all pages (not just the visible page).
    const list = scope === 'all' ? [...todos].sort((a, b) => a.order - b.order) : applyFilters(todos, query);
    if (list.length === 0) return;
    setBusy(true);
    try {
      const { downloadTodos } = await import('@/lib/exporter'); // load SheetJS on demand
      downloadTodos(list);
      message.success(`Exported ${list.length} task${list.length === 1 ? '' : 's'}.`);
    } catch (err) {
      console.error('[export] failed', err);
      message.error('Export failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const items: MenuProps['items'] = [
    { key: 'all', label: `All tasks (${todos.length})` },
    { key: 'view', label: `Current view, filtered and sorted (${view.total})`, disabled: view.total === 0 },
  ];

  return (
    <Dropdown
      menu={{ items, onClick: ({ key }) => handleExport(key as ExportScope) }}
      disabled={todos.length === 0}
      trigger={['click']}
    >
      <Button icon={<FileExcelOutlined />} loading={busy}>
        Export <DownOutlined />
      </Button>
    </Dropdown>
  );
}
