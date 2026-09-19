"use client";

/** Filtros da lista de clientes: busca livre, status e ordenação. */

import { FilterBar, FilterSelect } from "@/components/ui/filter-bar";
import { CLIENT_STATUS_OPTIONS, toSelectOptions } from "@/lib/domain/enums";
import type { ClientFilters as Filters } from "@/lib/schemas/crm";

const SORT_OPTIONS = [
  { value: "recent", label: "Mais recentes" },
  { value: "name", label: "Nome (A-Z)" },
  { value: "revenue", label: "Maior faturamento" },
];

export function ClientFilters({ filters }: { filters: Filters }) {
  return (
    <FilterBar
      action="/clientes"
      searchValue={filters.q}
      searchPlaceholder="Nome, empresa, e-mail ou telefone"
      hasActiveFilters={Boolean(filters.q || filters.status || filters.sort !== "recent")}
    >
      <FilterSelect
        name="status"
        label="Status"
        value={filters.status}
        options={toSelectOptions(CLIENT_STATUS_OPTIONS)}
      />
      <FilterSelect
        name="sort"
        label="Ordenar por"
        value={filters.sort}
        options={SORT_OPTIONS}
        allLabel="Mais recentes"
      />
    </FilterBar>
  );
}
