import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
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
  // The header row is frozen after writing (see freezeHeaderRow): the SheetJS
  // Community Edition doesn't write frozen panes itself.

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, SHEET_NAME);
  return workbook;
}

export function exportFileName(date: Date = new Date()): string {
  return `todos-${dayjs(date).format('YYYY-MM-DD')}.xlsx`;
}

const SHEET_XML = 'xl/worksheets/sheet1.xml';
const PLAIN_VIEW = '<sheetView workbookViewId="0"/>';
const FROZEN_VIEW =
  '<sheetView workbookViewId="0">' +
  '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
  '<selection pane="bottomLeft" activeCell="A2" sqref="A2"/>' +
  '</sheetView>';

/**
 * Freeze the first row of the first sheet in an .xlsx file by patching its
 * <sheetView> element. If SheetJS ever writes a different view, the file is
 * returned unchanged: an unfrozen header beats a broken file.
 */
export function freezeHeaderRow(xlsx: Uint8Array): Uint8Array {
  const files = unzipSync(xlsx);
  const sheet = files[SHEET_XML];
  if (!sheet) return xlsx;
  const xml = strFromU8(sheet);
  if (!xml.includes(PLAIN_VIEW)) return xlsx;
  files[SHEET_XML] = strToU8(xml.replace(PLAIN_VIEW, FROZEN_VIEW));
  return zipSync(files, { level: 6 });
}

/** The finished .xlsx bytes: workbook plus frozen header row. */
export function buildXlsx(todos: Todo[]): Uint8Array {
  const bytes = XLSX.write(buildWorkbook(todos), { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return freezeHeaderRow(new Uint8Array(bytes));
}

/** Build the file and trigger a browser download. */
export function downloadTodos(todos: Todo[], fileName = exportFileName()): void {
  const blob = new Blob([buildXlsx(todos) as Uint8Array<ArrayBuffer>], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoke on the next tick so the download has started.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
