# Driftsync

A calm personal routine hub. The home page is **Today**: what you're doing right now, today's plan, what's due, your goals and the week at a glance. Around it are a **calendar** (month and week), a fast day **planner** with repeating blocks and wake-up/bedtime lines, reusable **day and week templates**, **to-dos** (which can repeat too) and **goals**.

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

No environment variables are needed: data lives in `localStorage` on your device, and deploys on Vercel from `main` work with zero config. Accounts and sync across devices are optional; see [Accounts & sync](#accounts--sync-supabase).

## Stack and key decisions

- **Next.js App Router + TypeScript (strict) + Tailwind.** Pages are client-rendered because all data is local.
- **Zustand** for state and **zod** for validating everything loaded from storage or imported.
- **Framer Motion** for UI transitions. Respects `prefers-reduced-motion`.
- **Fonts** via `next/font`: Pixelify Sans for headings and the pixel-island logo wordmark, Inter for UI.
- **Themes**: a mode ("Time of day": light by day, dark in the evening; "Device": follows the OS; or always light/dark) plus a palette for each side: light **Paper, Cloud, Sakura, Mint** and dark **Dusk, Midnight** (true black for OLED), **Dim, Forest, Ember**. Palettes are defined once in `src/lib/themes.ts`, which generates the CSS variables and the previews in Settings. An inline script picks the palette before first paint so there is no flash. Every palette passes WCAG AA contrast in the axe audit.

## Folder structure

```
src/
  app/                    Routes: / (Today), /calendar, /planner, /templates, /todos, /settings
  components/
    shell/                App shell, nav, command palette (⌘/Ctrl+K), pixel-island logo
    ui/                   Dialog (focus-trapped, portalled), menu, toasts, controls, progress, repeat picker
    today/                Today dashboard: now/next, today's plan, to-dos, goals, week strip
    calendar/             Month grid + day panel, week time grid
    onboarding/           First-run flow (name, theme, activities)
    planner/              Timeline (drag create/move/resize, sleep lines), block editor, sleep dialog, side panel
    templates/            Template list, editor (reuses the planner timeline), block editor, apply dialog
    todos/                To-do list, details, goals panel, goal dialog
    settings/             Settings sections, theme picker
  lib/                    Pure, unit-tested logic
    time.ts               15-min snapping, move/resize, overlap columns, dates
    calendar.ts           Month/week grids, month math, labels, greetings
    recurrence.ts         Repeat rules: occursOn, nextOccurrence, plain-English descriptions, presets
    series.ts             Expands repeating blocks into occurrences; resolves wake/bedtime lines per day
    themes.ts             Palettes (single source for CSS variables and previews)
    goals.ts              Goal progress, subset reordering
    quick-add.ts          "@tomorrow !1 #list every monday" parser
    daycycle.ts           Day/night from local time (drives the "Time of day" mode)
  data/                   Persistence
    schema.ts             zod schemas + types, CURRENT_VERSION
    migrations.ts         Versioned migrations; never throws, drops only invalid records
    repository.ts         Repository interface (the only thing stores talk to)
    local-storage-repository.ts
    reset.ts              Granular resets (pure)
  sync/                   Optional Supabase sync: config, client, adapter, engine (pure, tested), runner
  components/account/     Sign-in page, auth callback, Settings → Account, header cloud, first-sync dialog
  store/                  Zustand stores (app data, UI state, sync status)
supabase/schema.sql       Tables, row-level security, the push function and Realtime (idempotent)
docs/supabase.md          Step-by-step: accounts and sync
```

## Pages

- **Today** (`/`): a "right now" card (current block with time left, or free time and what's next), today's plan with done checkboxes, to-dos that are overdue or due today with a quick-add field (defaults to today, understands `!1`, `#list`, `@date`), goal progress, and a 7-day strip showing how full each day is. On phones the to-dos come right after the plan.
- **Calendar** (`/calendar`): a month view where each day shows its blocks as colored chips (dots on phones), open to-dos due and goal deadlines; selecting a day opens a side panel with its plan, to-dos (tick them or add one for that day) and an "Open in planner" button. Arrow keys move between days, Page Up/Down change month, Home/End jump within the week, double-click opens the planner. A week view shows all seven days on one time grid with the current-time line; click any block or day header to edit it in the planner. View and date live in the URL (`?view=week&date=2026-10-17`).
- **Planner** (`/planner`, tomorrow by default; `?day=today` or `?date=YYYY-MM-DD`): drag to create, move and resize blocks. Side panel: to-dos to drag in, today's sleep times, templates. The ⋯ menu copies days, applies templates, saves the day or week as a template and opens the wake-up/bedtime dialog.
- **Templates** (`/templates`): day and week templates with a preview strip per day. **Edit** opens the template on the same timeline as the planner (week templates get a tab per weekday, plus "Copy Monday to every weekday / the weekend / …"). **Copy & edit** duplicates a template and opens the copy, for variations like "Exam week". **Apply** picks a day, or any day in a week for week templates. New templates can start empty, or from a planned day/week (planner ⋯ menu, or the calendar's week view).
- **To-dos & goals** (`/todos`) and **Settings** (`/settings`: profile, appearance, activities, planner, sleep, data, reset).

## Repeating things

- **Repeating blocks.** In the block editor, pick *Every day / weekday / weekend / week / 2 weeks / month / year* or a custom rule (every N days/weeks/months/years, which weekdays, optional end date). A repeating block is stored once as a *series*. Its occurrences are generated on the fly, so they cost nothing and reach as far into the future as you scroll.
  - When you change one occurrence (drag it, tick it done, edit it), only that occurrence is saved as a real block. The rest of the series stays untouched.
  - When you open a repeating block, choose whether edits apply to **This day** or **This & upcoming**. "Upcoming" splits the series at that day, so past days keep their history. Deleting asks the same question. "Does not repeat" keeps that day and stops the ones after.
  - Copying a day skips repeating blocks that already happen on the target day, and clearing a day only removes repeats from that day.
- **Repeating to-dos.** Set a repeat in the to-do details, or type it when adding: `Water plants every day`, `Standup every weekday`, `Bins every monday`, also `every weekend`, `every week`, `every month`, `every year`. Ticking one off marks it done and creates the next one with the next due date (never in the past). Un-ticking takes that new copy back.
- **Wake-up & bedtime lines.** Not blocks: thin lines on the timeline (and the calendar's week view), with the hours before waking and after bedtime shaded. Set them per day or repeating (e.g. weekdays 07:00, weekends 09:00, bedtime 23:00 every day) from the planner (⋯ menu, the side panel, or by clicking a line), or under Settings → Sleep. A one-day line beats a repeating one; where two repeating lines overlap, the one you added last wins. "Remove on this day" and "Stop repeating from here" handle exceptions.


## Extending

### Add a preset activity
Add an entry to `PRESET_ACTIVITIES` in `src/data/defaults.ts` (stable `key`, name, color). Custom activities can always be added in Settings → Activities.

### Add a theme
Add a `ThemeDef` to `THEME_DEFS` in `src/lib/themes.ts` (12 color tokens as `"r g b"`), and add its id to `LIGHT_THEMES` or `DARK_THEMES` in `src/data/schema.ts`. It appears in Settings and the command palette automatically. Run the axe audit to check contrast.

### Add a page
Create `src/app/<route>/page.tsx` (wrap components that read search params in `<Suspense>`), add it to `NAV_ITEMS` in `src/components/shell/nav.tsx` and add a "Go to" command in `src/components/shell/command-palette.tsx`.

## Data model

Everything persists through the `Repository` interface (`src/data/repository.ts`). UI and stores never touch `localStorage` directly.

- One versioned document (currently v4) with `version`, `profile` and `settings` singletons and `activities`, `blocks`, `series` (repeating blocks), `markers` (wake-up/bedtime lines), `todos`, `lists`, `goals`, `templates` collections.
- Repeat rules (`repeat`) are `{ freq: daily|weekly|monthly|yearly, interval, weekdays, until }`, anchored at the series' `from` date, the marker's `date` or the to-do's `due`. Monthly rules skip months without that day (like the 31st). Saved occurrences are blocks with `seriesId` + `seriesDate`; deleted ones are listed in the series' `skip`.
- Templates have a `kind` (`day` or `week`); each template block has an `id` and, for week templates, a `day` (weekday, 0 = Sunday), so a week template still fits if you switch the week to start on Sunday.
- Version history: v1 → v2 reworked character accessories. v2 → v3 removed the island and character: the character's name became your name (unless it was the default "Pip"), island themes mapped to light/dark, and plans, to-dos, goals and templates were kept. v3 → v4 added repeats, sleep lines, week templates and palettes: existing templates become day templates and existing blocks don't repeat. Everything else is unchanged.
- Every record has a UUID, `createdAt`, `updatedAt` and `deletedAt` (soft delete). Soft-deleted records are purged after 30 days.
- On load, data runs through `migrate()`: version steps upgrade old shapes, then zod validates each record. Invalid records are dropped and invalid fields fall back to defaults, so corrupted or hand-edited data never crashes the app.
- To change the shape: bump `CURRENT_VERSION`, add `migrations[oldVersion]`, and add a test in `src/lib/__tests__/migrations.test.ts`.

Export and import JSON live in Settings → Data. Imports go through the same migration and validation.

## Accounts & sync (Supabase)

Optional and off until configured. With two environment variables set, Driftsync gets sign-in (email magic links, plus Google/GitHub/… if you enable them) and syncs everything between your devices. Data is still saved on the device first, so the app stays instant and works offline; a background sync merges changes item by item (newest edit wins, deletions included), with Realtime for near-instant updates.

**Setup: follow [docs/supabase.md](docs/supabase.md).** In short: run [`supabase/schema.sql`](supabase/schema.sql) in the Supabase SQL editor, add your site's `/auth/callback` to the allowed redirect URLs, then set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (see `.env.example`) locally and in Vercel, and redeploy.

- Pages: `/login` (email link or provider) and `/auth/callback` (finishes sign-in, waits for the first sync). Settings → Account & sync shows the status and has Sync now, Sign out (optionally clearing the device) and Delete cloud copy. A small cloud in the header shows sync state while signed in.
- First sign-in on a device: an empty account receives this device's data; a fresh device receives the account's; if both have data you choose once between merging and using the account's data.
- Code: `src/sync/` (config, client, the Supabase adapter, the sync engine and the runner that decides when to sync) and `src/components/account/`. The engine is unit-tested against an in-memory server that follows the same rules as the SQL.

## Keyboard

- `⌘/Ctrl + K`: command palette (navigate, open this week or templates, set sleep times, add a to-do, switch mode or palette)
- Calendar: arrows move between days, `Page Up`/`Page Down` change month, `Home`/`End` start/end of week
- Planner: `N` new block, `T`/`M` today/tomorrow, `←`/`→` change day, `↑`/`↓` move the selected block, `Shift+↑/↓` resize, `D` done, `Delete` remove (a repeating block: only that day), `?` help
- Template editor: `N` new block, `Delete` remove the selected block, `↑`/`↓` move it
- To-dos: `/` focus the add field, `Alt+↑/↓` reorder

## Decisions and known limitations

- **Repeat edits default to "This day".** Dragging a repeating block on the timeline only moves that day (a toast says so); open the block and pick "This & upcoming" to change the rest. Editing the repeat rule itself always applies from that day on.
- **Sleep lines are per calendar day.** A bedtime after midnight (e.g. 00:30) shows at the top of that day, not at the bottom of the previous evening. Pick 23:45 or similar if you want it on the evening.
- **Applying a template adds blocks; it never replaces.** Clear the day first (⋯ → Clear this day) if you want a clean slate. Blocks added from a template don't stay linked to it, so editing the template later doesn't change days you've already planned.
- **Onboarding trims activities safely.** Activities you untick in onboarding are removed, unless a block or goal already uses them (so replaying onboarding never strips existing plans). Deleting an activity keeps its color on blocks and templates that used it. The last remaining activity can't be deleted.
- **The calendar is a viewer; the planner is the editor.** You can tick blocks and to-dos and add to-dos from the calendar, but creating or moving blocks happens in the planner (one click away). Drag-to-reschedule across days is a natural next step.
- **Habit goals count done blocks only.** Frequency goals ("jog 3× a week") count planner blocks of that activity that you mark done.
- **Overlaps are allowed** and shown side by side with a small warning marker instead of being blocked.
- **Touch:** dragging on empty timeline space scrolls, and tapping creates a block. Long-press a block to move it; resize handles respond immediately. To-dos use HTML5 drag and drop with a mouse, and long-press then drag on touch or pen (a floating preview plus a drop-time indicator). The calendar button schedules a to-do into the next free slot.
- **Sync is per item, newest edit wins.** Two devices editing the same block at the same time end up with whichever edit was made last (by each device's clock); edits to different items never conflict.
- **Out of scope for now:** calendar import/export (.ics), reminders.
