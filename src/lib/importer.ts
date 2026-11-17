import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { CATEGORIES } from '@/lib/categories';
import { DATE_FORMAT, DESCRIPTION_MAX } from '@/lib/validation';
import type { Category, ImportedTodo } from '@/types/todo';

/**
 * CSV / Excel import: read the file → find columns by header → validate each
 * row → return a preview for the user to confirm. Nothing touches app state here.
 *
 * `parseTable` is pure (rows in, preview out) so it's tested without files;
 * `readImportFile` is the thin SheetJS wrapper around it.
 */

export const MAX_IMPORT_ROWS = 2000;
export const ACCEPTED_EXTENSIONS = ['.csv', '.xlsx', '.xls'];

type Field = 'description' | 'category' | 'dueDate' | 'completed';

/** Header names are matched after normalizeHeader (lower-case, single spaces). */
const HEADER_ALIASES: Record<Field, string[]> = {
  description: ['description', 'task', 'title', 'name'],
  category: ['category', 'type'],
  dueDate: ['duedate', 'due date', 'due', 'deadline'],
  completed: ['completed', 'done', 'status'],
};

const TRUE_WORDS = new Set(['true', 'yes', 'y', '1', 'completed', 'complete', 'done']);
const FALSE_WORDS = new Set(['', 'false', 'no', 'n', '0', 'pending', 'incomplete', 'not done', 'todo', 'to do', 'open']);

/** Accepted text date formats. DD/MM/YYYY (not US MM/DD) per the plan. */
const DATE_INPUT_FORMATS = ['YYYY-MM-DD', 'YYYY-M-D', 'DD/MM/YYYY', 'D/M/YYYY'];

export interface RowIssue {
  row: number; // spreadsheet row number, as the user sees it in Excel (header = row 1)
  message: string;
}

export interface ImportPreview {
  rows: ImportedTodo[]; // valid rows, ready for importTodos()
  skipped: RowIssue[]; // rows left out, with the reason
  warnings: RowIssue[]; // rows imported with a value changed (bad category or date)
  error?: string; // the whole file couldn't be used
}

function emptyPreview(error: string): ImportPreview {
  return { rows: [], skipped: [], warnings: [], error };
}

export function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .replace(/^﻿/, '') // byte-order mark on the first header of some UTF-8 CSVs
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ');
}

function fieldForHeader(header: string): Field | undefined {
  return (Object.keys(HEADER_ALIASES) as Field[]).find((f) => HEADER_ALIASES[f].includes(header));
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return dayjs(value).format(DATE_FORMAT);
  return String(value).trim();
}

function isBlank(value: unknown): boolean {
  return cellText(value) === '';
}

type Parsed<T> = { value: T; ok: boolean };

export function parseCategory(value: unknown): Parsed<Category> {
  const text = cellText(value).toLowerCase();
  if (text === '') return { value: 'Personal', ok: true };
  const match = CATEGORIES.find((c) => c.toLowerCase() === text);
  return match ? { value: match, ok: true } : { value: 'Personal', ok: false };
}

/**
 * Excel stores dates as serial day numbers. parse_date_code converts the serial
 * straight to y/m/d with no Date object, so there's no time-zone shift.
 */
function fromExcelSerial(serial: number, date1904: boolean): string | null {
  if (!Number.isFinite(serial) || serial < 1 || serial > 2958465) return null; // up to 9999-12-31
  const parts = XLSX.SSF.parse_date_code(serial, { date1904 });
  if (!parts) return null;
  const d = dayjs(new Date(parts.y, parts.m - 1, parts.d));
  return d.isValid() ? d.format(DATE_FORMAT) : null;
}

export function parseDueDate(value: unknown, date1904 = false): Parsed<string | null> {
  if (value === null || value === undefined) return { value: null, ok: true };
  if (typeof value === 'number') {
    const date = fromExcelSerial(value, date1904);
    return date ? { value: date, ok: true } : { value: null, ok: false };
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? { value: null, ok: false }
      : { value: dayjs(value).format(DATE_FORMAT), ok: true };
  }
  const text = cellText(value);
  if (text === '') return { value: null, ok: true };
  for (const format of DATE_INPUT_FORMATS) {
    const d = dayjs(text, format, true);
    if (d.isValid()) return { value: d.format(DATE_FORMAT), ok: true };
  }
  return { value: null, ok: false };
}

export function parseCompleted(value: unknown): Parsed<boolean> {
  if (typeof value === 'boolean') return { value, ok: true };
  const text = cellText(value).toLowerCase();
  if (TRUE_WORDS.has(text)) return { value: true, ok: true };
  if (FALSE_WORDS.has(text)) return { value: false, ok: true };
  return { value: false, ok: false };
}

export interface ParseOptions {
  /** Workbook uses the 1904 date system (some older Mac Excel files). */
  date1904?: boolean;
  /** Sheet row number of rows[0], when the used range doesn't start at row 1. */
  firstRowNumber?: number;
}

/** Validate a table of cells. The first non-empty row is the header. */
export function parseTable(rows: unknown[][], options: ParseOptions = {}): ImportPreview {
  const { date1904 = false, firstRowNumber = 1 } = options;

  const headerIndex = rows.findIndex((r) => r.some((cell) => !isBlank(cell)));
  if (headerIndex === -1) return emptyPreview('The file is empty.');

  // Map each known field to its column; the first matching header wins.
  const columns: Partial<Record<Field, number>> = {};
  rows[headerIndex].forEach((cell, col) => {
    const field = fieldForHeader(normalizeHeader(cell));
    if (field && columns[field] === undefined) columns[field] = col;
  });
  const descCol = columns.description;
  if (descCol === undefined) {
    return emptyPreview(
      'No description column found. The header row needs a column named "description" (or task, title, name).',
    );
  }

  const preview: ImportPreview = { rows: [], skipped: [], warnings: [] };
  const get = (row: unknown[], field: Field) => {
    const col = columns[field];
    return col === undefined ? undefined : row[col];
  };

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const rowNumber = firstRowNumber + i;
    if (row.every(isBlank)) continue; // empty rows, including trailing ones: ignore silently

    if (preview.rows.length >= MAX_IMPORT_ROWS) {
      preview.skipped.push({
        row: rowNumber,
        message: `Import is limited to ${MAX_IMPORT_ROWS} tasks; this row and the rest were not read.`,
      });
      break;
    }

    const description = cellText(row[descCol]).replace(/\s+/g, ' ');
    if (description === '') {
      preview.skipped.push({ row: rowNumber, message: 'Missing description.' });
      continue;
    }
    if (description.length > DESCRIPTION_MAX) {
      preview.skipped.push({
        row: rowNumber,
        message: `Description is longer than ${DESCRIPTION_MAX} characters.`,
      });
      continue;
    }

    const category = parseCategory(get(row, 'category'));
    if (!category.ok) {
      preview.warnings.push({
        row: rowNumber,
        message: `Unknown category "${cellText(get(row, 'category'))}"; set to Personal.`,
      });
    }

    const dueDate = parseDueDate(get(row, 'dueDate'), date1904);
    if (!dueDate.ok) {
      preview.warnings.push({
        row: rowNumber,
        message: `Unrecognised due date "${cellText(get(row, 'dueDate'))}"; left empty. Use YYYY-MM-DD or DD/MM/YYYY.`,
      });
    }

    const completed = parseCompleted(get(row, 'completed'));
    if (!completed.ok) {
      preview.warnings.push({
        row: rowNumber,
        message: `Unrecognised status "${cellText(get(row, 'completed'))}"; treated as not completed.`,
      });
    }

    preview.rows.push({
      description,
      category: category.value,
      dueDate: dueDate.value,
      completed: completed.value,
    });
  }

  if (preview.rows.length === 0 && preview.skipped.length === 0) {
    return emptyPreview('The file has a header row but no tasks.');
  }
  return preview;
}

/** Read a CSV / XLSX / XLS file's first sheet and validate it. Never throws. */
export function readImportFile(data: ArrayBuffer, fileName: string): ImportPreview {
  const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
  if (!ACCEPTED_EXTENSIONS.includes(ext)) {
    return emptyPreview('Unsupported file type. Use .csv, .xlsx or .xls.');
  }

  let workbook: XLSX.WorkBook;
  try {
    workbook =
      ext === '.csv'
        ? // Decode ourselves (TextDecoder drops a UTF-8 BOM) and read with raw: true
          // so SheetJS doesn't guess types. Otherwise "05/12/2026" becomes 12 May (US order).
          XLSX.read(new TextDecoder('utf-8').decode(data), { type: 'string', raw: true })
        : // Without cellDates, date cells stay as serial numbers; parseDueDate converts them.
          XLSX.read(data, { type: 'array' });
  } catch {
    return emptyPreview('Could not read this file. Is it a valid CSV or Excel file?');
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
  if (!sheet || !sheet['!ref']) return emptyPreview('The file is empty.');

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: '',
    blankrows: true, // keep blank rows so reported row numbers match the spreadsheet
  });
  return parseTable(rows, {
    date1904: Boolean(workbook.Workbook?.WBProps?.date1904),
    firstRowNumber: XLSX.utils.decode_range(sheet['!ref']).s.r + 1,
  });
}
