# Driftsync

A calm, cozy routine hub. Your home page is a pixel-art floating island. Each building is a part of your life (gym, study, library, photo studio, running track, workshop, hobby). A little mini-me lives there and does whatever you've planned right now. Around the island is a fast day planner, a to-do list and goals.

There are no points, XP, levels or streaks. Progress shows up only as gentle visuals: areas you've used recently look lived in (flowers, lit windows), and neglected ones look quietly dusty.

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
- **Canvas 2D instead of PixiJS.** The island is a few hundred small sprites, so plain canvas is fast enough and keeps the bundle small. It also gives exact pixel control: everything is drawn at native pixel-art resolution into an offscreen "world" canvas, tinted for the time of day, then scaled up with integer factors and no smoothing.
- **All art is generated in code.** Small palette-indexed matrices (icons, props, hair, head) plus procedural rasterizers (iso boxes, roofs, terrain columns, clouds) are rendered once into cached offscreen canvases.
- **Framer Motion** for UI transitions. Respects `prefers-reduced-motion`, as does the island (no bob, slow clouds, no twinkle).
- **Fonts** via `next/font`: Pixelify Sans for headings/accents, Inter for UI.

## Folder structure

```
src/
  app/                    Routes: / (island), /planner, /todos, /settings
  components/
    shell/                App shell, nav, command palette (⌘/Ctrl+K), logo
    ui/                   Dialog (focus-trapped, portalled), menu, toasts, controls, progress
    island/               Island view, HUD, area sheet, add-area dialog, building previews
    character/            Character card + animated preview
    onboarding/           First-run flow + reusable character creator
    planner/              Timeline (drag create/move/resize), block editor, side panel
    todos/                To-do list, details, goals panel, goal dialog
    settings/             Settings sections
  island/                 Renderer (no React)
    scene.ts              Render loop, compositing, day/night, hit-testing, intro animation
    pixel-buffer.ts       Tiny software raster: polygons, matrices, outlines
    palettes.ts           All island colors (base + retro)
    iso.ts                2:1 isometric projection helpers
    decor.ts              Deterministic trees/bushes/flowers placement
    world.ts              Resolves stored areas into a layout (repairs bad data)
    character/controller.ts  Walks paths (A*), performs activities, wanders
    sprites/              buildings.ts, icons.ts, props.ts, character.ts, terrain.ts, clouds.ts
  lib/                    Pure, unit-tested logic
    island-layout.ts      Land shape, size tiers, smart placement, path generation
    pathfinding.ts        Grid A* + flood fill
    time.ts               15-min snapping, move/resize, overlap columns, dates
    goals.ts              Goal progress, subset reordering
    feedback.ts           "Lived in" / "dusty" island vitality (never numeric in UI)
    character-intent.ts   What the character should do now
    quick-add.ts          "@tomorrow !1 #list" parser
    daycycle.ts           Day/night light from local time
  data/                   Persistence
    schema.ts             zod schemas + types, CURRENT_VERSION
    migrations.ts         Versioned migrations; never throws, drops only invalid records
    repository.ts         Repository interface (the only thing stores talk to)
    local-storage-repository.ts
    supabase-repository.ts  Stub
    reset.ts              Granular resets (pure)
  store/                  Zustand stores (app data + UI state)
```

## How the island works

- **Placement** (`lib/island-layout.ts`): every area has a 2×2 footprint. Hard rules: on land with a one-tile apron, at least one tile between buildings and from the central plaza, and every entrance reachable from the plaza. Candidates are scored by distance to the center, distance to existing paths, crowding, closeness to the rim, and paths they'd cover. The island grows through size tiers (12 → 22 tiles) as you add areas, up to 12 areas. Positions are stored relative to the island center, so growing never moves anything.
- **Paths** grow as a tree from the plaza. Each entrance (nearest first) is routed to the existing network with A*, with existing path tiles discounted so routes merge naturally.
- **Character priority**: a manual "send to" wins until you clear it, or until a time block starts after you sent it. Otherwise the current time block's activity sends them to the linked area (laps around the track for jogging; activities without an area happen at the plaza). With nothing planned, they wander and idle.

## Extending

### Add a new area type
1. Add the id to `AREA_TYPES` in `src/data/schema.ts`. Existing data stays valid.
2. Add a label and blurb in `src/lib/activities.ts` (`AREA_LABELS`, `AREA_BLURBS`) and a default animation in `AREA_ANIMATION` (`src/lib/character-intent.ts`).
3. Add three style variants to `BUILDING_STYLES` in `src/island/sprites/buildings.ts`. Pick wall/roof colors, a roof type (`flat`/`pyramid`/`gable`), a window style, an icon, and an optional `extra` prop.
4. If you need a new sign icon, draw a 7×7 matrix in `src/island/sprites/icons.ts`.

### Add a preset activity
Add an entry to `PRESET_ACTIVITIES` in `src/data/defaults.ts` (stable `key`, name, color, animation, area type). Existing users can always add custom activities in Settings → Activities.

### Add or restyle sprites
- Colors: `src/island/palettes.ts` (terrain, sky, tints, glow).
- Props (trees, lamp…): matrices in `src/island/sprites/props.ts`. Each character in a row maps to a palette entry and `.` is transparent.
- Character: head/hair matrices and procedural limbs in `src/island/sprites/character.ts`. Animations are lists of poses in `ANIMATIONS`. Add a new `AnimName`, then map an `AnimationKind` to it in `island/character/controller.ts`.
- New character animation kinds also need an entry in `ANIMATIONS` in `src/data/schema.ts`.

## Data model

Everything persists through the `Repository` interface (`src/data/repository.ts`). UI and stores never touch `localStorage` directly.

- One versioned document (`version`, plus `profile`, `island`, `settings` singletons and `areas`, `activities`, `blocks`, `todos`, `lists`, `goals`, `templates` collections).
- Every record has a UUID, `createdAt`, `updatedAt` and `deletedAt` (soft delete). Soft-deleted records are purged after 30 days.
- On load, data runs through `migrate()`: version steps upgrade old shapes, then zod validates each record. Invalid records are dropped and invalid fields fall back to defaults, so corrupted or hand-edited data never crashes the app.
- To change the shape: bump `CURRENT_VERSION`, add `migrations[oldVersion]`, and add a test in `src/lib/__tests__/migrations.test.ts`.

Export and import JSON live in Settings → Data. Imports go through the same migration and validation.

## Connecting Supabase later

The switch already exists: `NEXT_PUBLIC_DRIFTSYNC_STORAGE=supabase` makes `getRepository()` (`src/data/index.ts`) call `createSupabaseRepository()`. Today that is a stub that throws, so the app falls back to local storage. To wire it up:

1. `npm install @supabase/supabase-js` and set `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (see `.env.example`).
2. Create one table per collection (`areas`, `activities`, `blocks`, `todos`, `lists`, `goals`, `templates`) with the zod schema fields as columns (snake_case), plus `user_id uuid references auth.users`, and an `app_state` table (one row per user) holding `profile`, `island` and `settings` as JSONB. Enable row-level security with `user_id = auth.uid()`.
3. Implement `Repository` in `src/data/supabase-repository.ts`:
   - `Collection.list()` → `select * where deleted_at is null`, then parse each row with the zod schema.
   - `put` / `putMany` → `upsert` on `id`. `remove` → set `deleted_at` (keep soft deletes so other devices see them).
   - `load()` → fetch everything and run it through `migrate()` for validation.
4. For offline-first sync, keep `LocalStorageRepository` as a cache and reconcile by `updated_at` (last write wins). The record shapes are already built for this.
5. Add auth (e.g. Supabase magic link) before enabling the switch. It's intentionally not included yet.

## Keyboard

- `⌘/Ctrl + K`: command palette (navigate, add a to-do, send your character somewhere, add an area, switch theme)
- Planner: `N` new block, `T`/`M` today/tomorrow, `←`/`→` change day, `↑`/`↓` move the selected block, `Shift+↑/↓` resize, `D` done, `Delete` remove, `?` help
- To-dos: `/` focus the add field, `Alt+↑/↓` reorder

## Decisions and known limitations

- **"Send to" beats the plan.** A manual send-to wins over your time blocks until you clear it, or until a new block starts after you sent it. That matches "do that instead until I clear it" without stranding your plan forever.
- **Habit goals count done blocks only.** Frequency goals ("jog 3× a week") count planner blocks of that activity that you mark done. Island "lived in" feedback also gives partial credit to past blocks you didn't tick.
- **Overlaps are allowed** and shown side by side with a small warning marker instead of being blocked.
- **Touch:** drag on empty timeline space scrolls; tap creates a block; long-press a block to move it. Resize handles respond immediately. Dragging a to-do onto the timeline uses HTML5 drag and drop (desktop). On touch, use the calendar button next to the to-do, which schedules it in the next free slot.
- **Not done yet:** Supabase sync and auth (stub only), and multi-day/week views.
