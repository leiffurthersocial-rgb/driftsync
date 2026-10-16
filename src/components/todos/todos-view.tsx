"use client";

import { useEffect, useState } from "react";
import { PageContainer, PageHeader } from "@/components/shell/page-header";
import { Segmented } from "@/components/ui/controls";
import { TodoPanel } from "./todo-panel";
import { GoalsPanel } from "./goals-panel";
import { cn } from "@/lib/cn";

export function TodosView() {
  const [tab, setTab] = useState<"todos" | "goals">("todos");
  useEffect(() => {
    if (window.location.hash === "#goals") setTab("goals");
  }, []);
  return (
    <PageContainer>
      <PageHeader
        title="To-dos & goals"
        subtitle="Small steps and the bigger picture."
        actions={
          <Segmented
            className="lg:hidden"
            label="Section"
            value={tab}
            onChange={setTab}
            options={[
              { value: "todos", label: "To-dos" },
              { value: "goals", label: "Goals" },
            ]}
          />
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className={cn(tab !== "todos" && "hidden lg:block")}>
          <TodoPanel />
        </div>
        <div className={cn(tab !== "goals" && "hidden lg:block")}>
          <GoalsPanel />
        </div>
      </div>
    </PageContainer>
  );
}
