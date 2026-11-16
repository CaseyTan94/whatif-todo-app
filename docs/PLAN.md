# WhatIf Solutions take-home: To-Do List App
**Build plan and design doc** · Khai Chzen Tan · drafted Mon, Nov 16, 2026

| | |
|---|---|
| **From** | Alan Liew (cc Chris Pang), sent Sat, Nov 14, 11:12 AM MYT |
| **Deliverable** | Submit the app through GitHub "within 7 days from now" |
| **Deadline** | **Sat, Nov 21.** Alan gave no time, so plan to submit **by Fri, Nov 20 at 9 PM** to be safe. |
| **Stack required** | Next.js + any open-source UI framework |
| **Still open** | Alan asked you to acknowledge receipt. You haven't replied yet, so do that today. |

---

## 1. Requirements checklist

Every item from the brief, with where it lives in the design (§) and the day it's built.

| # | Requirement (from the brief) | Type | Design § | Day |
|---|---|---|---|---|
| 1.1 | List to-do items | Required | 4, 5 | Tue |
| 1.2 | Add new items | Required | 5 | Tue |
| 1.3 | Delete items | Required | 5 | Tue |
| 1.4 | Edit items | Required | 5 | Tue |
| 1.5 | Mark complete / incomplete | Required | 5 | Tue |
| 1.6 | Set a due date per task | Required | 3, 5 | Tue |
| 1.7 | Categorise tasks (Work / Personal / Urgent) with a dropdown or radio buttons when adding | Required | 3, 5 | Tue |
| 2.1 | Pagination limits tasks per listing page | Required | 6 | Wed |
| 2.2 | Dropdown or slider for page size (5 / 10 / 15 / 20) | Required | 6 | Wed |
| 2.3 | Previous / Next / page-number controls | Required | 6 | Wed |
| 2.4 | Show current page and total pages | Required | 6 | Wed |
| 3.1 | Search bar filters on keywords in the task description | Required | 6 | Wed |
| 3.2 | Filter by status (all / completed / incomplete) | Required | 6 | Wed |
| 3.3 | Sort by due date, ascending or descending | Required | 6 | Wed |
| 4 | Local persistent storage; tasks survive reloads and reopening | Required | 7 | Mon (base), Thu (hardening) |
| 5 | Bulk import from CSV or Excel | Required | 8 | Thu |
| 6 | Export / download tasks as Excel | Required | 9 | Thu |
| 7 | Calendar view: tasks on their due dates, colour-coded by category | Optional extra | 10 | Fri |
| 8 | Drag-and-drop reordering | Optional extra | 11 | Fri |

Doing both extras is what will set you apart from other candidates. The plan keeps them on Friday so they never put the required work at risk.

---

## 2. Tech choices

| Concern | Choice | Why |
|---|---|---|
| Framework | **Next.js (latest, App Router) + TypeScript** | Matches what `create-next-app@latest` gives you today. TypeScript is a cheap signal of quality for reviewers. |
| UI framework | **Ant Design (`antd`)** | It ships `Table`, `Pagination`, `DatePicker`, `Select`, `Radio`, `Upload`, `Modal`, `Form`, `Tag` and a **`Calendar`** component. That covers almost every requirement, including the optional calendar, without extra libraries. Add `@ant-design/nextjs-registry` so styles render correctly with the App Router. |
| Dates | **dayjs** | Ant Design's DatePicker already uses it, so you don't need a second date library. |
| State | Custom **`useTodos`** hook (`useReducer` + context) | The brief's suggested structure names `hooks/useTodos.js`, so following it shows you read the brief. A state library like Redux would be overkill here. |
| Persistence | **localStorage behind a small storage adapter** | See §7. |
| Import / export | **SheetJS (`xlsx`)** | One library reads CSV and .xlsx and writes .xlsx. ⚠️ Install it from the SheetJS CDN tarball as their docs say. The npm-registry copy is an old, unmaintained version. If you'd rather avoid that, use `papaparse` for CSV plus `exceljs` for Excel. |
| Drag and drop | **`@hello-pangea/dnd`** (or `@dnd-kit`) | The brief suggests `react-beautiful-dnd`, but Atlassian has deprecated it and it doesn't work with current React and Strict Mode. `@hello-pangea/dnd` is the maintained fork with the same API. Say this in your README: it shows judgment, not just following instructions. |
| Tests | **Vitest + React Testing Library** | Fast tests for the list pipeline and the import parser, which is where the bugs will be. |
| Hosting (bonus) | **Vercel** | A free live demo link in the README saves the reviewer from cloning and installing. |

---

## 3. Data model

```ts
// src/types/todo.ts
export type Category = 'Work' | 'Personal' | 'Urgent';
export const CATEGORIES: Category[] = ['Work', 'Personal', 'Urgent'];

export interface Todo {
  id: string;            // crypto.randomUUID()
  description: string;   // the task text; the brief's search targets "task description"
  category: Category;
  dueDate: string | null; // 'YYYY-MM-DD' (date only, avoids time-zone drift)
  completed: boolean;
  order: number;         // manual position, used for drag-and-drop
  createdAt: string;     // ISO timestamp
  updatedAt: string;
}

export interface PersistedState {
  version: 1;            // schema version, for future migrations
  todos: Todo[];
  prefs: { pageSize: 5 | 10 | 15 | 20; view: 'list' | 'calendar' };
}
```

Design notes:
- **Store dates as `YYYY-MM-DD` strings, not `Date` objects.** They serialise cleanly to JSON, sort correctly as plain strings, and don't shift a day across time zones.
- **Category colours live in one map** (`Work → blue`, `Personal → green`, `Urgent → red`). The list tags, the form and the calendar all read from it, which gives you the "consistent colour scheme" the brief asks for.
- Validation: description is required and trimmed (1–200 characters), category must be one of the three, and dueDate must be a valid date or null.

---

## 4. Architecture and folder structure

This follows the brief's suggested layout, adapted to the App Router.

```
/whatif-todo-app
├── src/
│   ├── app/
│   │   ├── layout.tsx          # AntdRegistry + ConfigProvider (theme)
│   │   └── page.tsx            # 'use client' shell: toolbar, list/calendar tabs
│   ├── components/
│   │   ├── TodoList.tsx        # antd Table or List + pagination
│   │   ├── TodoItem.tsx        # row: checkbox, text, category tag, due date, actions
│   │   ├── AddTodo.tsx         # form: description, category (Select/Radio), DatePicker
│   │   ├── EditTodo.tsx        # same form in a Modal, pre-filled
│   │   ├── Filters.tsx         # search, status filter, sort, page size
│   │   ├── ImportTodos.tsx     # Upload + preview + result summary
│   │   ├── ExportButton.tsx
│   │   └── Calendar.tsx        # antd Calendar with cellRender
│   ├── hooks/
│   │   └── useTodos.ts         # reducer, actions, persistence, derived view
│   ├── lib/
│   │   ├── storage.ts          # load/save/migrate (localStorage adapter)
│   │   ├── query.ts            # pure functions: search → filter → sort → paginate
│   │   ├── importer.ts         # parse + validate rows from CSV/XLSX
│   │   ├── exporter.ts         # build the workbook
│   │   └── categories.ts       # category list + colour map
│   └── types/todo.ts
├── __tests__/                  # query.test.ts, importer.test.ts, useTodos.test.tsx
├── public/sample-import.csv    # template users can download
└── README.md
```

**The key idea is to keep the logic pure.** Put search, filter, sort, paginate, import parsing and export building in `lib/` as plain functions with no React. Components stay thin, the logic is easy to unit-test, and a reviewer can read `query.ts` and see the whole pipeline at a glance.

### `useTodos` API

```ts
const {
  todos,                         // all tasks (source of truth)
  view,                          // { items, total, page, totalPages } after the pipeline
  query, setQuery,               // { search, status, sortDir, page, pageSize }
  addTodo, updateTodo, deleteTodo, toggleTodo,
  importTodos,                   // (rows: Todo[]) => void
  reorder,                       // (fromId, toId) => void
  hydrated,                      // false until localStorage has loaded
} = useTodos();
```

Reducer actions: `HYDRATE`, `ADD`, `UPDATE`, `DELETE`, `TOGGLE`, `IMPORT`, `REORDER`.

---

## 5. Core CRUD (Requirement 1)

| Feature | UI | Behaviour |
|---|---|---|
| List | antd `Table` (or `List`) | Columns: ✓ checkbox · description (struck through when done) · category `Tag` in its colour · due date (red "Overdue" badge if past and not done) · edit/delete actions |
| Add | `AddTodo` form above the list | Description input, category **`Select` or `Radio.Group`** (the brief asks for one of these), `DatePicker`. Enter submits. The form clears and shows a success `message` toast. |
| Edit | `Modal` with the same form, pre-filled | Saves with `updateTodo` and bumps `updatedAt`. |
| Delete | `Popconfirm` → `deleteTodo` | If the page ends up empty, move back one page (see §6). |
| Complete | Row checkbox → `toggleTodo` | Instant, no confirmation. |

Empty state: antd `Empty` with "No tasks yet. Add one above or import a CSV."

---

## 6. Search, filter, sort and pagination (Requirements 2 and 3)

The list goes through one pure pipeline in `lib/query.ts`, in this order:

```
todos
  → search      description includes keyword (case-insensitive, trimmed; extra spaces collapsed)
  → status      all | completed | incomplete
  → sort        dueDate asc | desc  (tasks with no due date always go last)
                + "Manual order" option (sorts by `order`, enables drag-and-drop)
  → paginate    slice((page-1)*pageSize, page*pageSize)
  → { items, total, page, totalPages }
```

Rules that reviewers often test:
- **Reset to page 1** whenever search, status, sort or page size changes.
- **Clamp the page** when it would be empty: delete the last item on page 3 and you land on page 2, not a blank page 3.
- `totalPages = max(1, ceil(total / pageSize))`, so the label never says "Page 1 of 0".
- **Debounce search** by about 200 ms.
- Show the counts: "Page 2 of 5 · 43 tasks" (or "12 of 43 tasks match").

UI: antd `Pagination` with `showSizeChanger`, `pageSizeOptions={[5,10,15,20]}`, `showTotal`. Save the page size in `prefs` so it survives reloads.

**Tests (`query.test.ts`):** search matches regardless of case; each status filter; sort in both directions with tasks missing a due date; pagination edges (empty list, exact multiple of page size, last partial page, clamping).

---

## 7. Persistent storage (Requirement 4)

The brief says "research storage management methods", so **put the comparison in your README.** They want to see the reasoning.

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **localStorage** | Synchronous, simple, supported everywhere, plenty for thousands of tasks (about 5 MB) | Strings only, blocks the main thread on very large data | ✅ **Use it**, behind an adapter |
| IndexedDB (via `idb` / Dexie) | Large capacity, async, indexed queries | More code and setup | Mention it as the upgrade path for very large imports |
| sessionStorage | Simple | Cleared when the tab closes, so it fails the requirement | ❌ |
| Cookies | Sent with every request | ~4 KB limit, wrong tool for this | ❌ |

Implementation (`lib/storage.ts`):
- `load(): PersistedState`: read the key `whatif-todos:v1`, `JSON.parse` it inside try/catch, run `migrate()` if the version differs, and fall back to an empty state if the data is corrupt (and log a warning).
- `save(state)`: `JSON.stringify` it, wrapped in try/catch so a full or blocked storage shows an antd notification instead of crashing.
- **Avoid the SSR hydration trap.** localStorage doesn't exist on the server. Load inside `useEffect`, keep `hydrated=false` until then, and show an antd `Skeleton` meanwhile. Only save **after** loading, or the first render will overwrite the user's data with an empty list. This is the most common bug in Next.js to-do apps, so say in your README that you handled it.
- Optional: listen for the `storage` event so two open tabs stay in sync.

---

## 8. Bulk import from CSV or Excel (Requirement 5)

**Flow:** `Upload` (accepts `.csv,.xlsx,.xls`, `beforeUpload` returns false so nothing is uploaded to a server) → parse with SheetJS → validate → **preview modal** ("38 valid, 2 skipped" plus the reasons) → confirm → `importTodos`.

**Expected columns** (header names are case-insensitive and allow common aliases):

| Column | Required | Aliases | Rules |
|---|---|---|---|
| description | ✅ | task, title, name | trimmed, not empty |
| category | | type | Work / Personal / Urgent, case-insensitive; anything else becomes **Personal** (with a warning) |
| dueDate | | due, due date, deadline | `YYYY-MM-DD`, `DD/MM/YYYY`, or a real Excel date; invalid values become empty (with a warning) |
| completed | | done, status | true/false, yes/no, 1/0, "completed"; defaults to false |

Edge cases to handle and to mention in the README:
- **Excel stores dates as serial numbers.** Read with `cellDates: true` and format with dayjs.
- Byte-order marks (BOM) in UTF-8 CSVs, empty trailing rows, and a header row in a different column order.
- New `id`s are generated for every imported row, and imported tasks are **appended** after existing ones with continuing `order` values.
- Put a downloadable **`sample-import.csv`** template next to the button.

**Tests (`importer.test.ts`):** valid rows, missing description is skipped, bad category falls back to Personal, Excel serial date, both date formats, header aliases.

---

## 9. Export to Excel (Requirement 6)

- An **Export** dropdown with two options: "All tasks" and "Current view (filtered and sorted)". The second is a small extra that shows attention to detail.
- Columns: Description · Category · Due Date · Status (Completed / Pending) · Created · Updated.
- File name: `todos-YYYY-MM-DD.xlsx`. Set column widths and freeze the header row.
- Make the export columns match the import columns, so an exported file can be imported back unchanged. Call this out in the README.

---

## 10. Calendar view (optional Requirement 7)

- Add an antd `Tabs` with **List | Calendar** (remember the choice in `prefs.view`).
- Use antd's `Calendar` with `cellRender`. For each date, show up to 3 tasks due that day as small `Badge`s or `Tag`s in their **category colour**, plus "+N more" when there are more. Clicking a task opens `EditTodo`.
- Grey out and strike through completed tasks. Show a legend of category colours above the calendar.
- Group tasks by date once with `useMemo` (a map of date to tasks) so each cell doesn't filter the whole list.
- If you'd rather use one of the libraries the brief names, `react-big-calendar` gives you a month/week view, but antd's built-in Calendar means no extra dependency and a consistent style. One sentence in the README explaining the choice is enough.

---

## 11. Drag-and-drop reordering (optional Requirement 8)

- Use `@hello-pangea/dnd` (`DragDropContext` → `Droppable` → `Draggable`) on the list rows and give each row a drag handle.
- Reordering **writes the `order` field** and saves it.
- **Resolve the conflict with sorting:** drag-and-drop only makes sense when the list is in manual order. Enable it only when sort is set to "Manual order". In other modes, hide the handles and show the hint "Switch to Manual order to drag." When filters or pagination are active, reorder within the visible page by swapping the `order` values of the affected tasks. Reviewers will notice whether you thought about this.
- On a page, `reorder(fromId, toId)` works out the new positions and gives the moved items new `order` numbers.

---

## 12. Day-by-day build plan

About 3–4 focused hours a day. Each day ends with the app working and a pushed commit, so you always have something you could submit.

### Mon, Nov 16 (today): setup and foundations
- [ ] **Reply to Alan** to acknowledge the assessment and confirm you'll submit through GitHub by Sat, Nov 21. Ask what time on Saturday if you want certainty.
- [ ] Run `npx create-next-app@latest whatif-todo-app` (TypeScript, ESLint, App Router, `src/`).
- [ ] Install `antd`, `@ant-design/nextjs-registry` and `dayjs`, and set up the registry and `ConfigProvider` in `layout.tsx`.
- [ ] Create the public GitHub repo and push the scaffold. Connect Vercel so every push deploys automatically.
- [ ] Write `types/todo.ts`, `lib/categories.ts`, `lib/storage.ts` and a basic `useTodos` that loads, adds and saves.
- **Done when:** you can add a task, reload the page, and it's still there.

### Tue, Nov 17: Requirement 1, core CRUD
- [ ] `AddTodo` (description, category Select/Radio, DatePicker, validation).
- [ ] `TodoList` / `TodoItem` with checkbox, coloured tag, due date and overdue badge.
- [ ] `EditTodo` modal, delete with `Popconfirm`, toggle complete.
- [ ] Empty state and success/error toasts.
- **Done when:** every item 1.1–1.7 works and survives a reload.

### Wed, Nov 18: Requirements 2 and 3, the list pipeline
- [ ] `lib/query.ts` (search → status → sort → paginate), including page reset and clamping.
- [ ] `Filters` (debounced search, status `Segmented`/`Select`, sort direction, manual-order option).
- [ ] antd `Pagination` with page sizes 5/10/15/20 and "Page X of Y · N tasks".
- [ ] Set up Vitest and write `query.test.ts`.
- **Done when:** every item 2.1–3.3 works and the tests pass.

### Thu, Nov 19: Requirements 4, 5 and 6, persistence, import and export
- [ ] Harden storage: try/catch, schema version and migration, skeleton until loaded, optional sync across tabs.
- [ ] `lib/importer.ts` and `ImportTodos` with the preview and results summary, plus `sample-import.csv`.
- [ ] `lib/exporter.ts` and the `ExportButton` (all tasks and current view).
- [ ] `importer.test.ts`. Round-trip check: export, then import the same file.
- **Done when:** a 50-row CSV and an .xlsx with real Excel dates import cleanly, and the export opens correctly in Excel.
- *If you're behind, Friday's extras absorb the slip. The required features take priority.*

### Fri, Nov 20: extras, polish and submission
- [ ] Calendar tab with colour-coded tasks, a legend and click to edit (Requirement 7).
- [ ] Drag-and-drop in manual-order mode (Requirement 8).
- [ ] Polish: responsive layout (Ant Design's `Grid`), keyboard use, loading states, and seed demo data on first run (optional, with a "Clear all" button).
- [ ] Write the **README** (template in §13), take screenshots or a GIF, and check the Vercel link works in an incognito window.
- [ ] Do a fresh-clone test: `git clone` → `npm install` → `npm run dev` on a clean folder.
- [ ] **Submit tonight:** reply on Alan's thread with the repo link and the live demo link.

### Sat, Nov 21: deadline buffer
- Use the morning only if something broke. Otherwise you're done a day early, which reads well in itself.

---

## 13. README outline (what the reviewer reads first)

1. **Title + live demo link + screenshot/GIF**
2. **Features**: a checklist mirroring §1, marking the optional extras as done
3. **Getting started**: Node version, `npm install`, `npm run dev`, `npm test`
4. **Tech stack and why** (one line each, from §2)
5. **Storage research**: the comparison table from §7 and why you chose localStorage
6. **Import format**: the column table from §8 and a link to `sample-import.csv`
7. **Design decisions**: pure query pipeline, date-only strings, the hydration guard, drag-and-drop only in manual order, `@hello-pangea/dnd` instead of the deprecated `react-beautiful-dnd`
8. **Project structure** (the tree from §4)
9. **What I'd do next**: IndexedDB for very large lists, backend sync, user accounts, end-to-end tests with Playwright

---

## 14. Quality checklist before you submit

- [ ] Every row in §1 checked off by hand in a fresh browser profile
- [ ] No console errors or hydration warnings in the browser dev tools
- [ ] `npm run build` passes (no TypeScript or ESLint errors)
- [ ] Tests pass with `npm test`
- [ ] Repo is **public** (or Alan and Chris are invited), the default branch is `main`, and there are no `.env` files or `node_modules` in it
- [ ] Commit history shows steady progress with clear messages (don't squash it into one commit)
- [ ] README links work, and the live demo loads in incognito
- [ ] Reply sent on Alan's thread with both links before Sat, Nov 21
