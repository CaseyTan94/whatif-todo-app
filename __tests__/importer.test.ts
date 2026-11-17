import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { buildWorkbook, toExcelSerial } from '@/lib/exporter';
import {
  MAX_IMPORT_ROWS,
  parseCompleted,
  parseDueDate,
  parseTable,
  readImportFile,
} from '@/lib/importer';
import type { Todo } from '@/types/todo';

const encode = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer;
const csv = (text: string) => readImportFile(encode(text), 'tasks.csv');

function xlsxBytes(rows: unknown[][], tweak?: (ws: XLSX.WorkSheet) => void): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  tweak?.(ws);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

describe('parseTable', () => {
  it('imports valid rows', () => {
    const result = parseTable([
      ['description', 'category', 'dueDate', 'completed'],
      ['Write report', 'Work', '2026-11-25', 'false'],
      ['Call mum', 'Personal', '', 'true'],
    ]);
    expect(result.error).toBeUndefined();
    expect(result.skipped).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.rows).toEqual([
      { description: 'Write report', category: 'Work', dueDate: '2026-11-25', completed: false },
      { description: 'Call mum', category: 'Personal', dueDate: null, completed: true },
    ]);
  });

  it('skips a row with a missing description and reports its spreadsheet row number', () => {
    const result = parseTable([
      ['description', 'category'],
      ['Good row', 'Work'],
      ['   ', 'Urgent'],
    ]);
    expect(result.rows).toHaveLength(1);
    expect(result.skipped).toEqual([{ row: 3, message: 'Missing description.' }]);
  });

  it('skips descriptions over 200 characters', () => {
    const result = parseTable([['description'], ['x'.repeat(201)]]);
    expect(result.rows).toEqual([]);
    expect(result.skipped[0].message).toMatch(/longer than 200/);
  });

  it('falls back to Personal for an unknown category, with a warning', () => {
    const result = parseTable([
      ['description', 'category'],
      ['Task', 'Errands'],
    ]);
    expect(result.rows[0].category).toBe('Personal');
    expect(result.warnings).toEqual([{ row: 2, message: 'Unknown category "Errands"; set to Personal.' }]);
  });

  it('matches categories case-insensitively and defaults an empty one to Personal without a warning', () => {
    const result = parseTable([
      ['description', 'category'],
      ['A', 'URGENT'],
      ['B', 'work'],
      ['C', ''],
    ]);
    expect(result.rows.map((r) => r.category)).toEqual(['Urgent', 'Work', 'Personal']);
    expect(result.warnings).toEqual([]);
  });

  it('accepts header aliases in any case, spacing and column order', () => {
    const result = parseTable([
      ['Done', 'Deadline', 'TYPE', ' Task '],
      ['yes', '2026-12-01', 'Urgent', 'Fix the leak'],
    ]);
    expect(result.rows).toEqual([
      { description: 'Fix the leak', category: 'Urgent', dueDate: '2026-12-01', completed: true },
    ]);
  });

  it.each([['title'], ['name'], ['Due Date'], ['due_date'], ['due']])('recognises the "%s" header', (header) => {
    const isDate = /due/i.test(header);
    const result = parseTable([
      isDate ? ['description', header] : [header],
      isDate ? ['Task', '2026-11-30'] : ['Task'],
    ]);
    expect(result.error).toBeUndefined();
    if (isDate) expect(result.rows[0].dueDate).toBe('2026-11-30');
    else expect(result.rows[0].description).toBe('Task');
  });

  it('errors clearly when there is no description column', () => {
    const result = parseTable([['category', 'due'], ['Work', '2026-11-30']]);
    expect(result.error).toMatch(/No description column/);
  });

  it('ignores blank rows, including trailing ones, and keeps row numbers right', () => {
    const result = parseTable([
      ['description'],
      ['First'],
      ['', ''],
      [''],
      ['Second'],
      [],
      ['   '],
    ]);
    expect(result.rows.map((r) => r.description)).toEqual(['First', 'Second']);
    expect(result.skipped).toEqual([]);
  });

  it('finds the header after leading blank rows', () => {
    const result = parseTable([[], ['', ''], ['description'], ['Task']]);
    expect(result.rows).toHaveLength(1);
  });

  it('errors on an empty file or a header with no rows', () => {
    expect(parseTable([]).error).toMatch(/empty/);
    expect(parseTable([['description']]).error).toMatch(/no tasks/);
  });

  it(`stops after ${MAX_IMPORT_ROWS} tasks`, () => {
    const rows = [['description'], ...Array.from({ length: MAX_IMPORT_ROWS + 5 }, (_, i) => [`Task ${i}`])];
    const result = parseTable(rows);
    expect(result.rows).toHaveLength(MAX_IMPORT_ROWS);
    expect(result.skipped).toHaveLength(1);
  });
});

describe('parseDueDate', () => {
  it('accepts YYYY-MM-DD', () => {
    expect(parseDueDate('2026-11-20')).toEqual({ value: '2026-11-20', ok: true });
  });

  it('accepts DD/MM/YYYY (day first, not US month first)', () => {
    expect(parseDueDate('05/12/2026')).toEqual({ value: '2026-12-05', ok: true });
    expect(parseDueDate('5/1/2027')).toEqual({ value: '2027-01-05', ok: true });
  });

  it('converts an Excel serial date number', () => {
    expect(parseDueDate(46346)).toEqual({ value: '2026-11-20', ok: true });
    expect(parseDueDate(46346.75)).toEqual({ value: '2026-11-20', ok: true }); // with a time part
  });

  it('handles the 1904 date system', () => {
    expect(parseDueDate(46346 - 1462, true)).toEqual({ value: '2026-11-20', ok: true });
  });

  it('treats empty as no due date', () => {
    expect(parseDueDate('')).toEqual({ value: null, ok: true });
    expect(parseDueDate(undefined)).toEqual({ value: null, ok: true });
  });

  it('rejects invalid dates', () => {
    for (const bad of ['31/02/2026', '2026-13-01', 'next friday', '11/20/2026', -5]) {
      expect(parseDueDate(bad).ok).toBe(false);
    }
  });

  it('warns and leaves the date empty in a table', () => {
    const result = parseTable([['description', 'due'], ['Task', 'soon']]);
    expect(result.rows[0].dueDate).toBeNull();
    expect(result.warnings[0].message).toMatch(/Unrecognised due date "soon"/);
  });
});

describe('parseCompleted', () => {
  it.each([true, 'TRUE', 'yes', 'Y', '1', 1, 'Completed', 'done'])('%s → true', (v) => {
    expect(parseCompleted(v)).toEqual({ value: true, ok: true });
  });

  it.each([false, 'false', 'No', '0', 0, '', 'Pending', 'incomplete', undefined])('%s → false', (v) => {
    expect(parseCompleted(v)).toEqual({ value: false, ok: true });
  });

  it('defaults unknown values to false with a warning', () => {
    expect(parseCompleted('maybe')).toEqual({ value: false, ok: false });
  });
});

describe('readImportFile: CSV', () => {
  it('strips a UTF-8 byte-order mark from the first header', () => {
    const result = csv('﻿description,category\nTask,Work\n');
    expect(result.error).toBeUndefined();
    expect(result.rows[0]).toMatchObject({ description: 'Task', category: 'Work' });
  });

  it('keeps DD/MM/YYYY as day-first (no SheetJS type guessing)', () => {
    expect(csv('description,due\nTask,05/12/2026\n').rows[0].dueDate).toBe('2026-12-05');
  });

  it('handles quoted fields with commas, CRLF line endings and trailing blank lines', () => {
    const result = csv('description,category\r\n"Buy milk, eggs",Personal\r\n\r\n\r\n');
    expect(result.rows).toEqual([
      { description: 'Buy milk, eggs', category: 'Personal', dueDate: null, completed: false },
    ]);
  });

  it('reads the bundled sample template without warnings', async () => {
    const { readFile } = await import('node:fs/promises');
    const bytes = await readFile('public/sample-import.csv');
    const result = readImportFile(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, 'sample-import.csv');
    expect(result.error).toBeUndefined();
    expect(result.skipped).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.rows.length).toBeGreaterThan(0);
  });

  it('rejects unsupported file types', () => {
    expect(readImportFile(encode('x'), 'tasks.txt').error).toMatch(/Unsupported/);
  });
});

describe('readImportFile: Excel', () => {
  it('reads a real Excel date cell', () => {
    const bytes = xlsxBytes([['Task', 'Due Date'], ['Pay rent', 46346]], (ws) => {
      ws.B2.z = 'dd/mm/yyyy';
    });
    expect(readImportFile(bytes, 'tasks.xlsx').rows).toEqual([
      { description: 'Pay rent', category: 'Personal', dueDate: '2026-11-20', completed: false },
    ]);
  });

  it('reads booleans and text dates from cells', () => {
    const bytes = xlsxBytes([
      ['description', 'completed', 'dueDate'],
      ['A', true, '2026-11-20'],
      ['B', false, '20/11/2026'],
    ]);
    const { rows } = readImportFile(bytes, 'tasks.xlsx');
    expect(rows.map((r) => [r.completed, r.dueDate])).toEqual([
      [true, '2026-11-20'],
      [false, '2026-11-20'],
    ]);
  });

  it('reports a clear error for a corrupt file', () => {
    expect(readImportFile(encode('not really a spreadsheet'), 'tasks.xlsx').error).toBeDefined();
  });
});

describe('export → import round trip', () => {
  const todos: Todo[] = [
    {
      id: '1',
      description: 'Write report, with commas',
      category: 'Work',
      dueDate: '2026-11-25',
      completed: false,
      order: 0,
      createdAt: '2026-11-18T01:00:00.000Z',
      updatedAt: '2026-11-18T01:00:00.000Z',
    },
    {
      id: '2',
      description: 'Renew passport',
      category: 'Urgent',
      dueDate: null,
      completed: true,
      order: 1,
      createdAt: '2026-11-18T02:00:00.000Z',
      updatedAt: '2026-11-19T02:00:00.000Z',
    },
    {
      id: '3',
      description: 'Leap day',
      category: 'Personal',
      dueDate: '2028-02-29',
      completed: false,
      order: 2,
      createdAt: '2026-11-18T03:00:00.000Z',
      updatedAt: '2026-11-18T03:00:00.000Z',
    },
  ];

  it('imports an exported file back unchanged, with no warnings', () => {
    const bytes = XLSX.write(buildWorkbook(todos), { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const result = readImportFile(bytes, 'todos-2026-11-19.xlsx');
    expect(result.skipped).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.rows).toEqual(
      todos.map(({ description, category, dueDate, completed }) => ({ description, category, dueDate, completed })),
    );
  });

  it('writes due dates as real Excel date cells', () => {
    const sheet = buildWorkbook(todos).Sheets.Tasks;
    expect(sheet.C2).toMatchObject({ t: 'n', v: toExcelSerial('2026-11-25'), z: 'yyyy-mm-dd' });
    expect(toExcelSerial('2026-11-20')).toBe(46346);
  });
});
