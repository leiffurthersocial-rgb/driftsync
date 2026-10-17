"use client";

import { CalendarRange, Copy, LayoutTemplate, MoreHorizontal, Pencil, Play, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import type { Template } from "@/data/schema";
import { useApp } from "@/store/app-store";
import { toast } from "@/store/ui-store";
import { formatDuration } from "@/lib/time";
import { PageContainer, PageHeader } from "@/components/shell/page-header";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/controls";
import { Menu } from "@/components/ui/menu";
import { TemplatePreview } from "./template-preview";
import { ApplyTemplateDialog } from "./apply-template-dialog";
import { TemplateEditor } from "./template-editor";

/** /templates lists day and week templates; /templates?id=… edits one. */
export function TemplatesView() {
  const id = useSearchParams().get("id");
  return id ? <TemplateEditor key={id} id={id} /> : <TemplateList />;
}

function TemplateList() {
  const router = useRouter();
  const templates = useApp((s) => s.templates);
  const activities = useApp((s) => s.activities);
  const weekStart = useApp((s) => s.settings.weekStart);
  const byId = useMemo(() => new Map(activities.map((a) => [a.id, a])), [activities]);
  const [applying, setApplying] = useState<Template | null>(null);
  const [deleting, setDeleting] = useState<Template | null>(null);

  const create = (kind: Template["kind"]) => {
    const t = useApp.getState().addTemplate({ name: kind === "week" ? "New week" : "New day", kind });
    router.push(`/templates?id=${t.id}`);
  };
  const duplicate = (t: Template) => {
    const copy = useApp.getState().duplicateTemplate(t.id);
    if (copy) router.push(`/templates?id=${copy.id}`);
  };

  const groups: [string, Template[]][] = [
    ["Week templates", templates.filter((t) => t.kind === "week")],
    ["Day templates", templates.filter((t) => t.kind === "day")],
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Templates"
        subtitle="Reusable days and weeks. Edit them on a timeline, copy one to make a variation, and apply them from here or the planner."
        actions={
          <>
            <button className="btn-soft" onClick={() => create("day")}>
              <Plus size={16} /> Day template
            </button>
            <button className="btn-primary" onClick={() => create("week")}>
              <Plus size={16} /> Week template
            </button>
          </>
        }
      />
      {templates.length === 0 ? (
        <div className="card">
          <EmptyState icon={<LayoutTemplate size={20} />} title="No templates yet">
            Create one here, or save a planned day or week from the planner’s ⋯ menu.
          </EmptyState>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map(
            ([title, list]) =>
              list.length > 0 && (
                <section key={title} aria-labelledby={`tg-${title}`}>
                  <h2 id={`tg-${title}`} className="mb-3 text-sm font-semibold text-muted">
                    {title}
                  </h2>
                  <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {list.map((t) => {
                      const minutes = t.blocks.reduce((s, b) => s + b.end - b.start, 0);
                      return (
                        <li key={t.id} className="card flex flex-col p-4">
                          <div className="flex items-start gap-2">
                            {t.kind === "week" ? <CalendarRange size={16} className="mt-0.5 shrink-0 text-muted" aria-hidden /> : <LayoutTemplate size={16} className="mt-0.5 shrink-0 text-muted" aria-hidden />}
                            <div className="min-w-0 flex-1">
                              <Link href={`/templates?id=${t.id}`} className="block truncate rounded font-semibold hover:underline">
                                {t.name}
                              </Link>
                              <p className="text-xs text-muted">
                                {t.blocks.length} blocks · {formatDuration(minutes)}
                                {t.kind === "week" ? " per week" : ""}
                              </p>
                            </div>
                            <Menu
                              label={`Actions for ${t.name}`}
                              trigger={
                                <button className="btn-ghost h-8 w-8 shrink-0 p-0" aria-label={`More actions for ${t.name}`}>
                                  <MoreHorizontal size={16} />
                                </button>
                              }
                              items={[
                                { label: "Edit", icon: <Pencil size={15} />, onSelect: () => router.push(`/templates?id=${t.id}`) },
                                { label: "Copy & edit", icon: <Copy size={15} />, onSelect: () => duplicate(t) },
                                { label: "Apply…", icon: <Play size={15} />, onSelect: () => setApplying(t) },
                                "divider",
                                { label: "Delete", icon: <Trash2 size={15} />, onSelect: () => setDeleting(t), danger: true },
                              ]}
                            />
                          </div>
                          <div className="my-4 flex-1">
                            <TemplatePreview template={t} activities={byId} weekStart={weekStart} />
                          </div>
                          <div className="flex gap-2">
                            <Link href={`/templates?id=${t.id}`} className="btn-soft h-9 flex-1">
                              <Pencil size={14} aria-hidden /> Edit
                            </Link>
                            <button className="btn-soft h-9 flex-1" onClick={() => setApplying(t)}>
                              <Play size={14} aria-hidden /> Apply
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ),
          )}
        </div>
      )}
      <ApplyTemplateDialog template={applying} onClose={() => setApplying(null)} />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={`Delete “${deleting?.name}”?`}
        description="Blocks you already added from it stay in your planner."
        confirmLabel="Delete template"
        onConfirm={() => {
          if (!deleting) return;
          useApp.getState().removeTemplate(deleting.id);
          toast("Template deleted");
        }}
      />
    </PageContainer>
  );
}
