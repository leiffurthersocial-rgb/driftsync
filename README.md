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
    character/controller.ts  Walks paths (A*), changes outfits, performs routines, runs loops, wanders
    character/routines.ts    The different ways to do each activity (pure, tested)
    sprites/kit.ts        Isometric building kit: boxes, roofs, windows, doors, decals, 3D lines
    sprites/designs.ts    21 area designs (3 per area type) with spots and running loops
    sprites/              buildings.ts, character.ts, props.ts, terrain.ts, icons.ts, clouds.ts
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

- **Scale & camera**: tiles are 64×32 px; the island spans 24–44 tiles. Drag to pan, scroll or pinch to zoom, `0` frames the whole island and `F` follows your character (also on the on-screen camera toolbar). Only the visible part of the world is drawn each frame.
- **World**: an organic, lobed coastline; a fountain plaza at the center; a pond; a jogging trail that loops around the whole island near the coast; forests, meadows, lamps and benches scattered deterministically; a tapering rock cone underneath with hanging roots; small floating rocks drifting nearby.
- **Placement** (`lib/island-layout.ts`): every area has a 3×3 footprint. Hard rules: on land with a one-tile apron, off the trail and the pond, at least one tile between buildings and from the plaza, and every entrance reachable. Candidates are scored by distance to the center, distance to existing paths (a BFS distance field), crowding, closeness to the coast and paths they'd cover. The island grows through size tiers as you add areas (up to 12). Positions are stored relative to the island center, so growing never moves anything.
- **Paths** grow as a tree from the plaza: each entrance (nearest first) is routed to the existing network with A*, with existing path tiles discounted so routes merge; one connector joins the coastal trail.
- **Character priority**: a manual "send to" wins until you clear it (or until a time block starts after you sent it); otherwise the current block's activity; otherwise wandering.
- **Routines** (`island/character/routines.ts`): each activity can be done several ways. Jogging = laps on a track or sports field, or a lap around the whole island. Working out = curls, overhead presses, squats, jumping jacks, plus pull-ups and dips in the calisthenics park or yoga on the yoga deck. Studying, reading, photography, work, hobbies and rest have their own sets. With "Mix it up" (default) the routine rotates every 20 minutes, favouring what's special about the place; each activity can also be pinned to one routine in Settings → Activities.
- **Outfits**: sporty routines switch the character into gym clothes (with a little poof), and back afterwards. Toggle and color in the character editor's Sport tab.

## Extending

### Add a new area design (a new look for an existing type)
Append a `Design` to `DESIGNS[type]` in `src/island/sprites/designs.ts` (the variant index is its position). A design has an `id`, `name`, `blurb`, `outdoor`, an `accent`, a `draw(kit, { accent })` function and optional `spots` (named points in footprint tile units where the character performs) and `loop` (a closed running path). The `Kit` (`sprites/kit.ts`) gives you `box`, `hipRoof`, `gableU/V`, `flatRoof`, `dome`, `windowL/R`, `doorL`, `ground`, `line`, `post`, `bench`, `lamp`, `fence`, `tree`, `pot`, `sign` and wall textures (`brick`, `planks`, `vplanks`, `stone`, `siding`, `glassWall`). Windows drawn with the kit automatically glow at night. Render all designs to a PNG for review with `DESIGN_SHEET=/tmp/designs.png npx vitest run src/lib/__tests__/designs.test.ts`.

### Add a new area type
1. Add the id to `AREA_TYPES` in `src/data/schema.ts` (existing data stays valid).
2. Add a label and blurb in `src/lib/activities.ts` (`AREA_LABELS`, `AREA_BLURBS`) and a default animation in `AREA_ANIMATION` (`src/lib/character-intent.ts`).
3. Add three designs to `DESIGNS` for it.

### Add a way of doing an activity (a routine)
Add a `Routine` to `ROUTINES` in `src/island/character/routines.ts`: an animation, where it happens (`door`, a design `spot`, a design `loop`, or the island `trail`), whether it's `sport`y (gym clothes), an optional `lift` (hanging from bars) or `night`-only flag, or a list of `designs` it's limited to. It shows up automatically in Settings → Activities.

### Add a preset activity
Add an entry to `PRESET_ACTIVITIES` in `src/data/defaults.ts` (stable `key`, name, color, animation, area type). Custom activities can always be added in Settings → Activities.

### Add or restyle sprites
- **Colors**: `src/island/palettes.ts` (terrain, sky, tints, glow).
- **Props** (trees, lamps, fountain, floating rocks…): procedural functions in `src/island/sprites/props.ts`; placement in `src/island/decor.ts`.
- **Character** (`src/island/sprites/character.ts`): limbs are poseable polylines (`legPose`, `armPose`); hair, faces, clothing, headwear and eyewear are small drawing functions; animations are lists of poses in `ANIMATIONS`. To add a customization option, add it to the enum in `src/data/schema.ts` (with a `.catch` default), draw it in `character.ts`, and add a label in `components/character/character-creator.tsx`. Render every animation and a set of looks to PNGs with `SPRITE_SHEET=/tmp/char.png npx vitest run src/lib/__tests__/character-sprites.test.ts`.

## Data model

Everything persists through the `Repository` interface (`src/data/repository.ts`). UI and stores never touch `localStorage` directly.

- One versioned document (currently v2: v1 → v2 split the single character accessory into headwear / eyewear / neckwear / backpack and added per-activity routine styles), with `version`, plus `profile`, `island`, `settings` singletons and `areas`, `activities`, `blocks`, `todos`, `lists`, `goals`, `templates` collections).
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

- Island: drag to pan, scroll/pinch to zoom, `+`/`-` zoom, `0` whole island, `F` follow your character
- `⌘/Ctrl + K`: command palette (navigate, add a to-do, send your character somewhere, add an area, switch theme)
- Planner: `N` new block, `T`/`M` today/tomorrow, `←`/`→` change day, `↑`/`↓` move the selected block, `Shift+↑/↓` resize, `D` done, `Delete` remove, `?` help
- To-dos: `/` focus the add field, `Alt+↑/↓` reorder

## Decisions and known limitations

- **"Send to" beats the plan.** A manual send-to wins over your time blocks until you clear it, or until a new block starts after you sent it. That matches "do that instead until I clear it" without stranding your plan forever.
- **Habit goals count done blocks only.** Frequency goals ("jog 3× a week") count planner blocks of that activity that you mark done. Island "lived in" feedback also gives partial credit to past blocks you didn't tick.
- **Overlaps are allowed** and shown side by side with a small warning marker instead of being blocked.
- **Touch:** dragging on empty timeline space scrolls, and tapping creates a block. Long-press a block to move it; resize handles respond immediately. To-dos use HTML5 drag and drop with a mouse, and long-press then drag on touch or pen (a floating preview plus a drop-time indicator). The calendar button schedules a to-do into the next free slot.
- **Out of scope for now:** Supabase sync (stub plus wiring guide above), auth (the brief says not yet), and multi-day/week planner views.
