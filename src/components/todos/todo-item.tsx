"use client";

import { motion, Reorder, useDragControls } from "framer-motion";
import { Check, Flag, GripVertical, Target } from "lucide-react";
import type { Goal, Todo, TodoList } from "@/data/schema";
import { formatDateShort, relativeDayLabel } from "@/lib/time";
import { cn } from "@/lib/cn";

const PRIORITY_COLORS = ["", "#93a6bd", "#eea54b", "#e7795f"];
const PRIORITY_LABELS = ["", "Low", "Medium", "High"];

export function Checkbox({ checked, onChange, label, color = "rgb(var(--accent))" }: { checked: boolean; onChange(): void; label: string; color?: string }) {
  return (
    <button
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 transition", checked ? "border-transparent" : "border-line hover:border-muted")}
      style={checked ? { background: color } : undefined}
    >
      {checked && (
        <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 600, damping: 22 }}>
          <Check size={13} strokeWidth={3} className="text-white" />
        </motion.span>
      )}
    </button>
  );
}

function DueChip({ due, today }: { due: string; today: string }) {
  const rel = relativeDayLabel(due, today);
  const past = due < today;
  return (
    <span className={cn("text-[11px]", past ? "text-peach" : due === today ? "text-accent" : "text-muted")}>
      {rel ?? formatDateShort(due)}
    </span>
  );
}

interface ItemProps {
  todo: Todo;
  today: string;
  list?: TodoList;
  goal?: Goal;
  onToggle(): void;
  onOpen(): void;
  onMove(dir: -1 | 1): void;
  reorderable: boolean;
}

function ItemBody({ todo, today, list, goal, onToggle, onOpen, onMove, handle }: ItemProps & { handle?: React.ReactNode }) {
  return (
    <div
      className="group flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-surface-2/70 focus-within:bg-surface-2/70"
      onKeyDown={(e) => {
        if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
          e.preventDefault();
          onMove(e.key === "ArrowUp" ? -1 : 1);
        }
      }}
    >
      {handle}
      <Checkbox checked={todo.done} onChange={onToggle} label={`Mark “${todo.title}” ${todo.done ? "not done" : "done"}`} />
      <button onClick={onOpen} className="min-w-0 flex-1 text-left outline-none" aria-label={`${todo.title}. Open details. Alt+arrow keys to reorder.`}>
        <span className={cn("block truncate text-sm", todo.done && "text-muted line-through")}>{todo.title}</span>
        {(todo.due || list || goal) && (
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
            {todo.due && <DueChip due={todo.due} today={today} />}
            {list && <span className="text-[11px] text-muted">#{list.name}</span>}
            {goal && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted">
                <Target size={11} style={{ color: goal.color }} /> {goal.title}
              </span>
            )}
          </span>
        )}
      </button>
      {todo.priority > 0 && (
        <Flag size={14} style={{ color: PRIORITY_COLORS[todo.priority] }} aria-label={`${PRIORITY_LABELS[todo.priority]} priority`} className="shrink-0" fill="currentColor" />
      )}
    </div>
  );
}

/** A reorderable to-do row (drag handle, or Alt+↑/↓ from the keyboard). */
export function TodoItem(props: ItemProps) {
  const controls = useDragControls();
  if (!props.reorderable)
    return (
      <motion.li layout initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}>
        <ItemBody {...props} />
      </motion.li>
    );
  return (
    <Reorder.Item value={props.todo.id} dragListener={false} dragControls={controls} className="relative" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <ItemBody
        {...props}
        handle={
          <span
            onPointerDown={(e) => controls.start(e)}
            className="-ml-1 cursor-grab touch-none text-muted/40 transition group-hover:text-muted active:cursor-grabbing"
            aria-hidden
          >
            <GripVertical size={16} />
          </span>
        }
      />
    </Reorder.Item>
  );
}
