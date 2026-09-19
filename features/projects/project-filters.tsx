"use client";

/**
 * Filtros e seletor de visualização dos projetos.
 *
 * O modo de visualização (cards, tabela, kanban) fica na URL como os demais
 * filtros: o link que você manda para o sócio abre exatamente como você viu.
 */

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Columns3, LayoutGrid, Table2 } from "lucide-react";
import { FilterBar, FilterSelect } from "@/components/ui/filter-bar";
import { cn } from "@/lib/cn";
import {
  PRIORITY_OPTIONS,
  PROJECT_STATUS_OPTIONS,
  PROJECT_TYPE_OPTIONS,
  toSelectOptions,
} from "@/lib/domain/enums";
import type { ProjectFilters as Filters } from "@/lib/schemas/crm";

const SORT_OPTIONS = [
  { value: "deadline", label: "Prazo mais próximo" },
  { value: "recent", label: "Mais recentes" },
  { value: "value", label: "Maior valor" },
  { value: "name", label: "Nome (A-Z)" },
];

const VIEWS = [
  { value: "cards", label: "Cards", icon: LayoutGrid },
  { value: "tabela", label: "Tabela", icon: Table2 },
  { value: "kanban", label: "Kanban", icon: Columns3 },
] as const;

export function ProjectFilters({
  filters,
  clients,
}: {
  filters: Filters;
  clients: ReadonlyArray<{ id: string; name: string; company: string | null }>;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function viewHref(view: string): string {
    const params = new URLSearchParams(searchParams.toString());
    if (view === "cards") params.delete("view");
    else params.set("view", view);
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1" role="group" aria-label="Forma de visualizar">
        {VIEWS.map((view) => {
          const active = filters.view === view.value;
          return (
            <Link
              key={view.value}
              href={viewHref(view.value)}
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

      <FilterBar
        action="/projetos"
        searchValue={filters.q}
        searchPlaceholder="Projeto, descrição ou cliente"
        hasActiveFilters={Boolean(
          filters.q ||
            filters.status ||
            filters.type ||
            filters.priority ||
            filters.clientId ||
            filters.overdue,
        )}
      >
        {/* O modo de visualização viaja junto ao filtrar. */}
        {filters.view !== "cards" ? (
          <input type="hidden" name="view" value={filters.view} />
        ) : null}

        <FilterSelect
          name="status"
          label="Status"
          value={filters.status}
          options={toSelectOptions(PROJECT_STATUS_OPTIONS)}
        />
        <FilterSelect
          name="type"
          label="Tipo"
          value={filters.type}
          options={toSelectOptions(PROJECT_TYPE_OPTIONS)}
        />
        <FilterSelect
          name="priority"
          label="Prioridade"
          value={filters.priority}
          options={toSelectOptions(PRIORITY_OPTIONS)}
        />
        <FilterSelect
          name="clientId"
          label="Cliente"
          value={filters.clientId}
          options={clients.map((client) => ({
            value: client.id,
            label: client.company ?? client.name,
          }))}
        />
        <FilterSelect
          name="sort"
          label="Ordenar por"
          value={filters.sort}
          options={SORT_OPTIONS}
          allLabel="Prazo mais próximo"
        />
      </FilterBar>
    </div>
  );
}
