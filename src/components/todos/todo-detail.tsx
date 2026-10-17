"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "@/store/app-store";
import { toast } from "@/store/ui-store";
import { Dialog } from "@/components/ui/dialog";
import { Segmented } from "@/components/ui/controls";
import { RepeatPicker } from "@/components/ui/repeat-picker";
import { addDays, toDateKey } from "@/lib/time";

export function TodoDetail({ todoId, onClose }: { todoId: string | null; onClose(): void }) {
  const todo = useApp((s) => s.todos.find((t) => t.id === todoId) ?? null);
  const lists = useApp((s) => s.lists);
  const goals = useApp((s) => s.goals);
  const weekStart = useApp((s) => s.settings.weekStart);
  const { updateTodo, removeTodo } = useApp.getState();
  const [title, setTitle] = useState("");
  useEffect(() => {
    if (todo) setTitle(todo.title);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todo?.id]);
  if (!todo) return null;
  const today = toDateKey(new Date());

  const commit = () => {
    const t = title.trim();
    if (t && t !== todo.title) updateTodo(todo.id, { title: t });
  };

  return (
    <Dialog
      open={!!todo}
      onClose={() => {
        commit();
        onClose();
      }}
      variant="sheet"
      title="To-do"
      footer={
        <>
          <button
            className="btn-ghost mr-auto text-danger"
            onClick={() => {
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { id, createdAt, updatedAt, deletedAt, ...rest } = todo;
              removeTodo(todo.id);
              onClose();
              toast("To-do deleted", { action: { label: "Undo", run: () => useApp.getState().addTodo(rest) } });
            }}
          >
            <Trash2 size={16} /> Delete
          </button>
          <button
            className="btn-primary"
            onClick={() => {
              commit();
              onClose();
            }}
          >
            Done
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <label htmlFor="todo-title" className="label">
            Title
          </label>
          <input id="todo-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && commit()} />
        </div>
        <div>
          <label htmlFor="todo-due" className="label">
            Due
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input id="todo-due" type="date" className="input w-auto" value={todo.due ?? ""} onChange={(e) => updateTodo(todo.id, { due: e.target.value || null })} />
            {[
              ["Today", today],
              ["Tomorrow", addDays(today, 1)],
              ["Next week", addDays(today, 7)],
            ].map(([label, d]) => (
              <button key={label} className="chip text-muted hover:text-ink" onClick={() => updateTodo(todo.id, { due: d })}>
                {label}
              </button>
            ))}
            {todo.due && !todo.repeat && (
              <button className="chip text-muted hover:text-ink" onClick={() => updateTodo(todo.id, { due: null })}>
                Clear
              </button>
            )}
          </div>
        </div>
        <div>
          <label htmlFor="todo-repeat" className="label">
            Repeat
          </label>
          <RepeatPicker
            id="todo-repeat"
            value={todo.repeat}
            anchor={todo.due ?? today}
            weekStart={weekStart}
            onChange={(repeat) => updateTodo(todo.id, { repeat, due: todo.due ?? (repeat ? today : null) })}
          />
          {todo.repeat && <p className="mt-1.5 text-xs text-muted">When you tick it off, the next one appears with its new due date.</p>}
        </div>
        <div>
          <span className="label">Priority</span>
          <Segmented
            label="Priority"
            value={todo.priority}
            onChange={(priority) => updateTodo(todo.id, { priority })}
            options={[
              { value: 0, label: "None" },
              { value: 1, label: "Low" },
              { value: 2, label: "Medium" },
              { value: 3, label: "High" },
            ]}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="todo-list" className="label">
              List
            </label>
            <select id="todo-list" className="input" value={todo.listId ?? ""} onChange={(e) => updateTodo(todo.id, { listId: e.target.value || null })}>
              <option value="">Inbox</option>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="todo-goal" className="label">
              Goal
            </label>
            <select id="todo-goal" className="input" value={todo.goalId ?? ""} onChange={(e) => updateTodo(todo.id, { goalId: e.target.value || null })}>
              <option value="">None</option>
              {goals
                .filter((g) => !g.archived)
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="todo-notes" className="label">
            Notes
          </label>
          <textarea
            id="todo-notes"
            key={todo.id}
            className="input min-h-[96px] resize-y"
            defaultValue={todo.notes}
            onBlur={(e) => e.target.value !== todo.notes && updateTodo(todo.id, { notes: e.target.value })}
            placeholder="Details, links, thoughts…"
          />
        </div>
      </div>
    </Dialog>
  );
}
