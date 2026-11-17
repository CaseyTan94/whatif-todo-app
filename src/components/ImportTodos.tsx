'use client';

import { useState } from 'react';
import dayjs from 'dayjs';
import { DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import { Alert, App, Button, Collapse, Flex, Modal, Table, Tag, Typography, Upload } from 'antd';
import type { UploadProps } from 'antd';
import { useTodos } from '@/hooks/useTodos';
import { CATEGORY_COLORS } from '@/lib/categories';
import { DATE_FORMAT } from '@/lib/validation';
import type { ImportPreview, RowIssue } from '@/lib/importer';
import type { ImportedTodo } from '@/types/todo';

const MAX_FILE_BYTES = 5 * 1024 * 1024; // localStorage holds ~5 MB in total anyway
const ISSUES_SHOWN = 50;

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function IssueList({ issues }: { issues: RowIssue[] }) {
  return (
    <ul style={{ margin: 0, paddingInlineStart: 20, maxHeight: 180, overflowY: 'auto' }}>
      {issues.slice(0, ISSUES_SHOWN).map((issue, i) => (
        <li key={i}>
          <Typography.Text type="secondary">Row {issue.row}:</Typography.Text> {issue.message}
        </li>
      ))}
      {issues.length > ISSUES_SHOWN && <li>…and {issues.length - ISSUES_SHOWN} more.</li>}
    </ul>
  );
}

const previewColumns = [
  { title: 'Description', dataIndex: 'description', ellipsis: true },
  {
    title: 'Category',
    dataIndex: 'category',
    width: 100,
    render: (c: ImportedTodo['category']) => <Tag color={CATEGORY_COLORS[c]}>{c}</Tag>,
  },
  {
    title: 'Due',
    dataIndex: 'dueDate',
    width: 110,
    render: (d: string | null) => (d ? dayjs(d, DATE_FORMAT).format('D MMM YYYY') : '—'),
  },
  {
    title: 'Done',
    dataIndex: 'completed',
    width: 70,
    render: (done: boolean) => (done ? 'Yes' : 'No'),
  },
];

/** Upload → parse → preview modal ("38 valid, 2 skipped" + reasons) → confirm → importTodos. */
export default function ImportTodos() {
  const { importTodos } = useTodos();
  const { message } = App.useApp();
  const [preview, setPreview] = useState<(ImportPreview & { fileName: string }) | null>(null);
  const [reading, setReading] = useState(false);

  const beforeUpload: UploadProps['beforeUpload'] = async (file) => {
    if (file.size > MAX_FILE_BYTES) {
      message.error('That file is larger than 5 MB.');
      return Upload.LIST_IGNORE;
    }
    setReading(true);
    try {
      // Load SheetJS only when someone actually imports.
      const [{ readImportFile }, data] = await Promise.all([import('@/lib/importer'), file.arrayBuffer()]);
      const result = readImportFile(data, file.name);
      if (result.error) message.error(result.error, 6);
      else setPreview({ ...result, fileName: file.name });
    } catch (err) {
      console.error('[import] failed', err);
      message.error('Something went wrong reading that file.');
    } finally {
      setReading(false);
    }
    return Upload.LIST_IGNORE; // never upload anywhere; everything happens in the browser
  };

  function confirmImport() {
    if (!preview) return;
    const added = importTodos(preview.rows);
    message.success(`Imported ${plural(added, 'task')}.`);
    setPreview(null);
  }

  const validCount = preview?.rows.length ?? 0;

  return (
    <>
      <Flex gap={4} align="center">
        <Upload accept=".csv,.xlsx,.xls" showUploadList={false} beforeUpload={beforeUpload} maxCount={1}>
          <Button icon={<UploadOutlined />} loading={reading}>
            Import
          </Button>
        </Upload>
        <Button type="link" href="/sample-import.csv" download icon={<DownloadOutlined />} size="small">
          CSV template
        </Button>
      </Flex>

      <Modal
        title={preview ? `Import from ${preview.fileName}` : 'Import'}
        open={preview !== null}
        width={720}
        okText={`Import ${plural(validCount, 'task')}`}
        okButtonProps={{ disabled: validCount === 0 }}
        onOk={confirmImport}
        onCancel={() => setPreview(null)}
        destroyOnHidden
      >
        {preview && (
          <Flex vertical gap={12}>
            <Alert
              type={validCount === 0 ? 'error' : preview.skipped.length || preview.warnings.length ? 'warning' : 'success'}
              showIcon
              title={
                `${validCount} valid, ${preview.skipped.length} skipped` +
                (preview.warnings.length ? ` · ${plural(preview.warnings.length, 'warning')}` : '')
              }
              description="Imported tasks are added after your existing ones."
            />

            {(preview.skipped.length > 0 || preview.warnings.length > 0) && (
              <Collapse
                size="small"
                defaultActiveKey={preview.skipped.length ? ['skipped'] : ['warnings']}
                items={[
                  ...(preview.skipped.length
                    ? [{ key: 'skipped', label: `Skipped rows (${preview.skipped.length})`, children: <IssueList issues={preview.skipped} /> }]
                    : []),
                  ...(preview.warnings.length
                    ? [{ key: 'warnings', label: `Imported with changes (${preview.warnings.length})`, children: <IssueList issues={preview.warnings} /> }]
                    : []),
                ]}
              />
            )}

            {validCount > 0 && (
              <Table<ImportedTodo>
                size="small"
                columns={previewColumns}
                dataSource={preview.rows.map((r, i) => ({ ...r, key: i }))}
                pagination={{ pageSize: 5, size: 'small', showSizeChanger: false }}
                scroll={{ x: 520 }}
              />
            )}
          </Flex>
        )}
      </Modal>
    </>
  );
}
