"use client";

/**
 * Filtros das tarefas. "Minhas tarefas" é um atalho: em vez de escolher o
 * próprio nome na lista de responsáveis, um clique resolve - e o servidor
 * sabe quem está logado, então o filtro não depende de id na URL.
 */

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Columns3, List } from "lucide-react";
import { FilterBar, FilterSelect } from "@/components/ui/filter-bar";
import { cn } from "@/lib/cn";
import { PRIORITY_OPTIONS, TASK_STATUS_OPTIONS, toSelectOptions } from "@/lib/domain/enums";
import type { TaskFilters as Filters } from "@/lib/schemas/work";
import type { ProjectOption, UserOption } from "@/features/tasks/task-form";

const VIEWS = [
  { value: "kanban", label: "Kanban", icon: Columns3 },
  { value: "lista", label: "Lista", icon: List },
] as const;

export function TaskFilters({
  filters,
  projects,
  users,
}: {
  filters: Filters;
  projects: ReadonlyArray<ProjectOption>;
  users: ReadonlyArray<UserOption>;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function hrefWith(key: string, value: string, defaultValue: string): string {
    const params = new URLSearchParams(searchParams.toString());
    if (value === defaultValue) params.delete(key);
    else params.set(key, value);
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1" role="group" aria-label="Forma de visualizar">
          {VIEWS.map((view) => {
            const active = filters.view === view.value;
            return (
              <Link
                key={view.value}
                href={hrefWith("view", view.value, "kanban")}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors",
                  active
                    ? "border-line-strong bg-surface font-medium text-ink"
                    : "border-transparent text-ink-muted hover:bg-surface-muted hover:text-ink",
                )}
              >
                <view.icon className="size-3.5" aria-hidden />
                {view.label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-1" role="group" aria-label="De quem são as tarefas">
          {[
            { value: "todas", label: "Todas" },
            { value: "minhas", label: "Minhas tarefas" },
          ].map((scope) => {
            const active = filters.scope === scope.value;
            return (
              <Link
                key={scope.value}
                href={hrefWith("scope", scope.value, "todas")}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "rounded-md border px-2.5 py-1.5 text-xs transition-colors",
                  active
                    ? "border-line-strong bg-surface font-medium text-ink"
                    : "border-transparent text-ink-muted hover:bg-surface-muted hover:text-ink",
                )}
              >
                {scope.label}
              </Link>
            );
          })}
        </div>
      </div>

      <FilterBar
        action="/tarefas"
        searchValue={filters.q}
        searchPlaceholder="Título, descrição ou projeto"
        hasActiveFilters={Boolean(
          filters.q ||
            filters.status ||
            filters.priority ||
            filters.projectId ||
            filters.assignedUserId ||
            filters.scope === "minhas",
        )}
      >
        {filters.view !== "kanban" ? (
          <input type="hidden" name="view" value={filters.view} />
        ) : null}
        {filters.scope !== "todas" ? (
          <input type="hidden" name="scope" value={filters.scope} />
        ) : null}

        <FilterSelect
          name="status"
          label="Situação"
          value={filters.status}
          options={toSelectOptions(TASK_STATUS_OPTIONS)}
        />
        <FilterSelect
          name="priority"
          label="Prioridade"
          value={filters.priority}
          options={toSelectOptions(PRIORITY_OPTIONS)}
        />
        <FilterSelect
          name="projectId"
          label="Projeto"
          value={filters.projectId}
          options={projects.map((project) => ({ value: project.id, label: project.name }))}
        />
        {filters.scope === "todas" ? (
          <FilterSelect
            name="assignedUserId"
            label="Responsável"
            value={filters.assignedUserId}
            options={users.map((user) => ({ value: user.id, label: user.name }))}
          />
        ) : null}
      </FilterBar>
    </div>
  );
}
