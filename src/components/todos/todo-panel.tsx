"use client";

import { AnimatePresence, Reorder } from "framer-motion";
import { ChevronDown, Inbox, ListPlus, MoreHorizontal, Pencil, Plus, Sun, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/store/app-store";
import { toast } from "@/store/ui-store";
import { parseQuickAdd } from "@/lib/quick-add";
import { toDateKey } from "@/lib/time";
import { EmptyState } from "@/components/ui/controls";
import { Menu } from "@/components/ui/menu";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { TodoItem } from "./todo-item";
import { TodoDetail } from "./todo-detail";
import { cn } from "@/lib/cn";

type Filter = "all" | "inbox" | "today" | string;

export function TodoPanel() {
  const todos = useApp((s) => s.todos);
  const lists = useApp((s) => s.lists);
  const goals = useApp((s) => s.goals);
  const today = toDateKey(new Date());
  const [filter, setFilter] = useState<Filter>("all");
  const [value, setValue] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [listDialog, setListDialog] = useState<{ id: string | null; name: string } | null>(null);
  const [confirmList, setConfirmList] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const matches = (t: (typeof todos)[number]) =>
    filter === "all" ? true : filter === "inbox" ? !t.listId : filter === "today" ? !!t.due && t.due <= today : t.listId === filter;

  const open = useMemo(() => todos.filter((t) => !t.done && matches(t)).sort((a, b) => a.order - b.order), [todos, filter, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const done = useMemo(
    () => todos.filter((t) => t.done && matches(t)).sort((a, b) => (b.doneAt ?? "").localeCompare(a.doneAt ?? "")),
    [todos, filter, today], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Local order while dragging; committed on drop.
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => setIds(open.map((t) => t.id)), [open]);

  // "/" focuses the add field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) && !document.querySelector("[role=dialog]")) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const add = () => {
    const parsed = parseQuickAdd(value, lists, today);
    if (!parsed.title) return;
    const listId = parsed.listId ?? (filter !== "all" && filter !== "inbox" && filter !== "today" ? filter : null);
    const due = parsed.due ?? (filter === "today" ? today : null);
    useApp.getState().addTodo({ ...parsed, listId, due });
    setValue("");
  };

  const move = (id: string, dir: -1 | 1) => {
    const i = ids.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    const next = [...ids];
    [next[i], next[j]] = [next[j], next[i]];
    setIds(next);
    useApp.getState().reorderTodos(next);
  };

  const byId = new Map(todos.map((t) => [t.id, t]));
  const toggle = (id: string) => {
    const t = byId.get(id);
    useApp.getState().toggleTodo(id);
    if (t && !t.done) toast("Nice — checked off", { tone: "success", action: { label: "Undo", run: () => useApp.getState().toggleTodo(id) } });
  };
  const listOf = (id: string | null) => lists.find((l) => l.id === id);
  const goalOf = (id: string | null) => goals.find((g) => g.id === id);
  const counts = (f: Filter) => todos.filter((t) => !t.done && (f === "all" ? true : f === "inbox" ? !t.listId : f === "today" ? !!t.due && t.due <= today : t.listId === f)).length;
  const filters: { id: Filter; label: string; icon?: React.ReactNode }[] = [
    { id: "all", label: "All" },
    { id: "inbox", label: "Inbox", icon: <Inbox size={14} /> },
    { id: "today", label: "Today", icon: <Sun size={14} /> },
    ...[...lists].sort((a, b) => a.order - b.order).map((l) => ({ id: l.id, label: l.name })),
  ];
  const currentList = listOf(filter);

  return (
    <section aria-labelledby="todos-heading" className="card flex min-h-[60vh] flex-col p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id="todos-heading" className="text-lg font-semibold">
          To-dos
        </h2>
        <div className="flex items-center gap-1">
          {currentList && (
            <Menu
              label="List options"
              trigger={
                <button className="btn-ghost h-8 w-8 p-0" aria-label="List options">
                  <MoreHorizontal size={16} />
                </button>
              }
              items={[
                { label: "Rename list", icon: <Pencil size={15} />, onSelect: () => setListDialog({ id: currentList.id, name: currentList.name }) },
                { label: "Delete list", icon: <Trash2 size={15} />, danger: true, onSelect: () => setConfirmList(currentList.id) },
              ]}
            />
          )}
          <button className="btn-ghost h-8 gap-1.5 px-2 text-sm text-muted" onClick={() => setListDialog({ id: null, name: "" })}>
            <ListPlus size={16} /> New list
          </button>
        </div>
      </div>

      <div role="tablist" aria-label="To-do lists" className="-mx-1 mb-3 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {filters.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm transition",
              filter === f.id ? "bg-ink text-bg" : "text-muted hover:bg-surface-2 hover:text-ink",
            )}
          >
            {f.icon}
            {f.label}
            <span className={cn("text-xs", filter === f.id ? "text-bg/70" : "text-muted/70")}>{counts(f.id) || ""}</span>
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
        className="mb-2 flex items-center gap-2 rounded-xl border border-line bg-surface px-3 transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25"
      >
        <Plus size={16} className="text-muted" aria-hidden />
        <label htmlFor="todo-add" className="sr-only">
          Add a to-do
        </label>
        <input
          id="todo-add"
          ref={input}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Add a to-do  ·  @tomorrow  !1  #list"
          className="h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-muted/70"
          autoComplete="off"
        />
        <kbd className="kbd hidden sm:inline">/</kbd>
      </form>

      <div className="flex-1">
        {open.length === 0 && done.length === 0 ? (
          <EmptyState icon={<Inbox size={20} />} title={filter === "today" ? "Nothing due today" : "Nothing here yet"}>
            Type above and press Enter. Try “water plants @tomorrow !2”.
          </EmptyState>
        ) : (
          <Reorder.Group axis="y" values={ids} onReorder={setIds} className="space-y-0.5" as="ul">
            <AnimatePresence initial={false}>
              {ids.map((id) => {
                const t = byId.get(id);
                if (!t) return null;
                return (
                  <TodoItem
                    key={id}
                    todo={t}
                    today={today}
                    list={filter === "all" ? listOf(t.listId) : undefined}
                    goal={goalOf(t.goalId)}
                    onToggle={() => toggle(id)}
                    onOpen={() => setOpenId(id)}
                    onMove={(dir) => move(id, dir)}
                    reorderable
                  />
                );
              })}
            </AnimatePresence>
          </Reorder.Group>
        )}
        {/* Persist drag order when the pointer is released. */}
        <PersistOrder ids={ids} openIds={open.map((t) => t.id)} />

        {done.length > 0 && (
          <div className="mt-4 border-t border-line/60 pt-3">
            <button className="flex items-center gap-1.5 text-sm text-muted hover:text-ink" onClick={() => setShowDone((v) => !v)} aria-expanded={showDone}>
              <ChevronDown size={16} className={cn("transition", !showDone && "-rotate-90")} />
              Completed · {done.length}
            </button>
            {showDone && (
              <ul className="mt-1 space-y-0.5">
                <AnimatePresence initial={false}>
                  {done.slice(0, 50).map((t) => (
                    <TodoItem key={t.id} todo={t} today={today} goal={goalOf(t.goalId)} onToggle={() => toggle(t.id)} onOpen={() => setOpenId(t.id)} onMove={() => {}} reorderable={false} />
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </div>
        )}
      </div>

      <TodoDetail todoId={openId} onClose={() => setOpenId(null)} />

      <Dialog
        open={!!listDialog}
        onClose={() => setListDialog(null)}
        title={listDialog?.id ? "Rename list" : "New list"}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setListDialog(null)}>
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                if (!listDialog?.name.trim()) return;
                if (listDialog.id) useApp.getState().updateList(listDialog.id, { name: listDialog.name.trim() });
                else setFilter(useApp.getState().addList(listDialog.name).id);
                setListDialog(null);
              }}
            >
              Save
            </button>
          </>
        }
      >
        <label htmlFor="list-name" className="label">
          Name
        </label>
        <input
          id="list-name"
          data-autofocus
          className="input"
          maxLength={40}
          value={listDialog?.name ?? ""}
          onChange={(e) => setListDialog((d) => d && { ...d, name: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter" && listDialog?.name.trim()) {
              if (listDialog.id) useApp.getState().updateList(listDialog.id, { name: listDialog.name.trim() });
              else setFilter(useApp.getState().addList(listDialog.name).id);
              setListDialog(null);
            }
          }}
          placeholder="Home, Errands, Side project…"
        />
      </Dialog>
      <ConfirmDialog
        open={!!confirmList}
        onClose={() => setConfirmList(null)}
        title="Delete this list?"
        description="Its to-dos move to your Inbox — nothing is lost."
        confirmLabel="Delete list"
        onConfirm={() => {
          if (confirmList) useApp.getState().removeList(confirmList);
          setFilter("all");
        }}
      />
    </section>
  );
}

/** Commit the drag order once the user lets go (Reorder only reports intermediate orders). */
function PersistOrder({ ids, openIds }: { ids: string[]; openIds: string[] }) {
  const latest = useRef(ids);
  latest.current = ids;
  useEffect(() => {
    const onUp = () => {
      if (latest.current.join() !== openIds.join()) useApp.getState().reorderTodos(latest.current);
    };
    window.addEventListener("pointerup", onUp);
    return () => window.removeEventListener("pointerup", onUp);
  }, [openIds]);
  return null;
}
