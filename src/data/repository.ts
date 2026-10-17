import type {
  Activity,
  AppData,
  BaseRecord,
  Block,
  Marker,
  Series,
  Goal,
  Profile,
  Settings,
  Template,
  Todo,
  TodoList,
} from "./schema";
import type { ResetScope } from "./reset";

/** A set of records with soft-delete semantics. `list()` never returns deleted records. */
export interface Collection<T extends BaseRecord> {
  list(): Promise<T[]>;
  /** Insert or replace by id. Bumps updatedAt. */
  put(item: T): Promise<T>;
  putMany(items: T[]): Promise<void>;
  /** Soft delete: sets deletedAt so a future sync can propagate it. */
  remove(id: string): Promise<void>;
}

export interface Singleton<T> {
  get(): Promise<T>;
  save(value: T): Promise<T>;
}

/**
 * The only way UI and stores touch persisted data.
 * Implemented by LocalStorageRepository; src/sync keeps it in sync with Supabase.
 */
export interface Repository {
  readonly kind: "local";
  /** Load everything at once (used for hydration). */
  load(): Promise<AppData>;

  profile: Singleton<Profile>;
  settings: Singleton<Settings>;

  activities: Collection<Activity>;
  blocks: Collection<Block>;
  series: Collection<Series>;
  markers: Collection<Marker>;
  todos: Collection<Todo>;
  lists: Collection<TodoList>;
  goals: Collection<Goal>;
  templates: Collection<Template>;

  exportAll(): Promise<AppData>;
  /** Validate + migrate arbitrary JSON and replace all data with it. */
  importAll(raw: unknown): Promise<AppData>;
  reset(scope: ResetScope): Promise<AppData>;
}
