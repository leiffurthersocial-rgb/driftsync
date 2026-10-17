# Driftsync

A calm personal routine hub. The home page is **Today**: what you're doing right now, today's plan, what's due, your goals and the week at a glance. Around it are a **calendar** (month and week), a fast day **planner**, **to-dos** and **goals**.

There are no points, XP, levels or streaks. Goals show plain progress ("2 of 3 milestones"), nothing more.

## Running it

```bash
npm install
npm run dev        # http://localhost:3000
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm run lint` | ESLint (next/core-web-vitals + typescript) |
| `npm test` | Vitest unit tests for the pure logic |
| `npm run check` | typecheck + lint + tests |

No environment variables are needed. Data lives in `localStorage` on your device. Deploys on Vercel from `main` work with zero config.

## Stack and key decisions

- **Next.js App Router + TypeScript (strict) + Tailwind.** Pages are client-rendered because all data is local.
- **Zustand** for state and **zod** for validating everything loaded from storage or imported.
- **Framer Motion** for UI transitions. Respects `prefers-reduced-motion`.
- **Fonts** via `next/font`: Pixelify Sans for headings and the pixel-island logo wordmark, Inter for UI.
- **Themes**: "Time of day" (light by day, dark in the evening), "Device" (follows the OS), or fixed light/dark. An inline script picks the theme before first paint so there is no flash.

## Folder structure

```
src/
  app/                    Routes: / (Today), /calendar, /planner, /todos, /settings
  components/
    shell/                App shell, nav, command palette (⌘/Ctrl+K), pixel-island logo
    ui/                   Dialog (focus-trapped, portalled), menu, toasts, controls, progress
    today/                Today dashboard: now/next, today's plan, to-dos, goals, week strip
    calendar/             Month grid + day panel, week time grid
    onboarding/           First-run flow (name, theme, activities)
    planner/              Timeline (drag create/move/resize), block editor, side panel
    todos/                To-do list, details, goals panel, goal dialog
    settings/             Settings sections
  lib/                    Pure, unit-tested logic
    time.ts               15-min snapping, move/resize, overlap columns, dates
    calendar.ts           Month/week grids, month math, labels, greetings
    goals.ts              Goal progress, subset reordering
    quick-add.ts          "@tomorrow !1 #list" parser
    daycycle.ts           Day/night from local time (drives the "Time of day" theme)
  data/                   Persistence
    schema.ts             zod schemas + types, CURRENT_VERSION
    migrations.ts         Versioned migrations; never throws, drops only invalid records
    repository.ts         Repository interface (the only thing stores talk to)
    local-storage-repository.ts
    supabase-repository.ts  Stub
    reset.ts              Granular resets (pure)
  store/                  Zustand stores (app data + UI state)
```

## Pages

- **Today** (`/`): a "right now" card (current block with time left, or free time and what's next), today's plan with done checkboxes, to-dos that are overdue or due today with a quick-add field (defaults to today, understands `!1`, `#list`, `@date`), goal progress, and a 7-day strip showing how full each day is. On phones the to-dos come right after the plan.
- **Calendar** (`/calendar`): a month view where each day shows its blocks as colored chips (dots on phones), open to-dos due and goal deadlines; selecting a day opens a side panel with its plan, to-dos (tick them or add one for that day) and an "Open in planner" button. Arrow keys move between days, Page Up/Down change month, Home/End jump within the week, double-click opens the planner. A week view shows all seven days on one time grid with the current-time line; click any block or day header to edit it in the planner. View and date live in the URL (`?view=week&date=2026-10-17`).
- **Planner** (`/planner`, tomorrow by default; `?day=today` or `?date=YYYY-MM-DD`), **To-dos & goals** (`/todos`), **Settings** (`/settings`): as before.

## Extending

### Add a preset activity
Add an entry to `PRESET_ACTIVITIES` in `src/data/defaults.ts` (stable `key`, name, color). Custom activities can always be added in Settings → Activities.

### Add a page
Create `src/app/<route>/page.tsx` (wrap components that read search params in `<Suspense>`), add it to `NAV_ITEMS` in `src/components/shell/nav.tsx` and add a "Go to" command in `src/components/shell/command-palette.tsx`.

## Data model

Everything persists through the `Repository` interface (`src/data/repository.ts`). UI and stores never touch `localStorage` directly.

- One versioned document (currently v3) with `version`, `profile` and `settings` singletons and `activities`, `blocks`, `todos`, `lists`, `goals`, `templates` collections.
- Version history: v1 → v2 reworked character accessories; v2 → v3 removed the island and character. On upgrade the island, its areas and the character's look are dropped, the character's name becomes your name (unless it was the default "Pip"), the island themes map to light (Day, Retro) or dark (Dusk), and activities lose their island links. Plans, to-dos, goals, templates and planner settings are kept as they were.
- Every record has a UUID, `createdAt`, `updatedAt` and `deletedAt` (soft delete). Soft-deleted records are purged after 30 days.
- On load, data runs through `migrate()`: version steps upgrade old shapes, then zod validates each record. Invalid records are dropped and invalid fields fall back to defaults, so corrupted or hand-edited data never crashes the app.
- To change the shape: bump `CURRENT_VERSION`, add `migrations[oldVersion]`, and add a test in `src/lib/__tests__/migrations.test.ts`.

Export and import JSON live in Settings → Data. Imports go through the same migration and validation.

## Connecting Supabase later

The switch already exists: `NEXT_PUBLIC_DRIFTSYNC_STORAGE=supabase` makes `getRepository()` (`src/data/index.ts`) call `createSupabaseRepository()`. Today that is a stub that throws, so the app falls back to local storage. To wire it up:

1. `npm install @supabase/supabase-js` and set `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (see `.env.example`).
2. Create one table per collection (`activities`, `blocks`, `todos`, `lists`, `goals`, `templates`) with the zod schema fields as columns (snake_case), plus `user_id uuid references auth.users`, and an `app_state` table (one row per user) holding `profile` and `settings` as JSONB. Enable row-level security with `user_id = auth.uid()`.
3. Implement `Repository` in `src/data/supabase-repository.ts`:
   - `Collection.list()` → `select * where deleted_at is null`, then parse each row with the zod schema.
   - `put` / `putMany` → `upsert` on `id`. `remove` → set `deleted_at` (keep soft deletes so other devices see them).
   - `load()` → fetch everything and run it through `migrate()` for validation.
4. For offline-first sync, keep `LocalStorageRepository` as a cache and reconcile by `updated_at` (last write wins). The record shapes are already built for this.
5. Add auth (e.g. Supabase magic link) before enabling the switch. It's intentionally not included yet.

## Keyboard

- `⌘/Ctrl + K`: command palette (navigate, open this week, add a to-do, switch theme)
- Calendar: arrows move between days, `Page Up`/`Page Down` change month, `Home`/`End` start/end of week
- Planner: `N` new block, `T`/`M` today/tomorrow, `←`/`→` change day, `↑`/`↓` move the selected block, `Shift+↑/↓` resize, `D` done, `Delete` remove, `?` help
- To-dos: `/` focus the add field, `Alt+↑/↓` reorder

## Decisions and known limitations

- **The island is gone.** v3 removes the island, its areas and the character entirely; the pixel-island mark survives only as the logo (top left, links to Today).
- **Onboarding trims activities safely.** Activities you untick in onboarding are removed, unless a block or goal already uses them (so replaying onboarding never strips existing plans). Deleting an activity keeps its color on blocks and templates that used it. The last remaining activity can't be deleted.
- **The calendar is a viewer; the planner is the editor.** You can tick blocks and to-dos and add to-dos from the calendar, but creating or moving blocks happens in the planner (one click away). Drag-to-reschedule across days is a natural next step.
- **Habit goals count done blocks only.** Frequency goals ("jog 3× a week") count planner blocks of that activity that you mark done.
- **Overlaps are allowed** and shown side by side with a small warning marker instead of being blocked.
- **Touch:** dragging on empty timeline space scrolls, and tapping creates a block. Long-press a block to move it; resize handles respond immediately. To-dos use HTML5 drag and drop with a mouse, and long-press then drag on touch or pen (a floating preview plus a drop-time indicator). The calendar button schedules a to-do into the next free slot.
- **Out of scope for now:** Supabase sync (stub plus wiring guide above), auth, recurring blocks and calendar import/export.
