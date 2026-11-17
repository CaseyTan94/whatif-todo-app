import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import type { Todo } from '@/types/todo';

/**
 * Excel export. Headers match what lib/importer.ts recognises ("Due Date" →
 * dueDate, "Status" → completed; Created/Updated are ignored on import), so an
 * exported file can be imported back unchanged.
 */

export const EXPORT_HEADERS = ['Description', 'Category', 'Due Date', 'Status', 'Created', 'Updated'] as const;

const SHEET_NAME = 'Tasks';
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30); // serial 0 in Excel's 1900 date system
const MS_PER_DAY = 86_400_000;

/**
 * 'YYYY-MM-DD' → Excel serial day number. UTC arithmetic on a date-only value,
 * so the result doesn't depend on the user's time zone.
 */
export function toExcelSerial(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return (Date.UTC(y, m - 1, d) - EXCEL_EPOCH_UTC) / MS_PER_DAY;
}

function timestamp(iso: string): string {
  const d = dayjs(iso);
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm') : '';
}

export function buildWorkbook(todos: Todo[]): XLSX.WorkBook {
  const rows = todos.map((t) => [
    t.description,
    t.category,
    // A real Excel date (serial + date format), so it sorts and filters as a date in Excel.
    t.dueDate ? { t: 'n', v: toExcelSerial(t.dueDate), z: 'yyyy-mm-dd' } : '',
    t.completed ? 'Completed' : 'Pending',
    timestamp(t.createdAt),
    timestamp(t.updatedAt),
  ]);
  const sheet = XLSX.utils.aoa_to_sheet([[...EXPORT_HEADERS], ...rows]);

  const longest = todos.reduce((max, t) => Math.max(max, t.description.length), 'Description'.length);
  sheet['!cols'] = [
    { wch: Math.min(Math.max(longest, 20), 60) },
    { wch: 10 },
    { wch: 12 },
    { wch: 11 },
    { wch: 17 },
    { wch: 17 },
  ];
  // Freezing the header row isn't possible here: the SheetJS Community Edition
  // doesn't write frozen panes.

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, SHEET_NAME);
  return workbook;
}

export function exportFileName(date: Date = new Date()): string {
  return `todos-${dayjs(date).format('YYYY-MM-DD')}.xlsx`;
}

/** Build the workbook and trigger a browser download. */
export function downloadTodos(todos: Todo[], fileName = exportFileName()): void {
  XLSX.writeFile(buildWorkbook(todos), fileName, { compression: true });
}
