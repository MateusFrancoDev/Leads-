"use client";

/**
 * Filtros da página Financeiro: período, cliente, projeto, situação e forma
 * de pagamento.
 *
 * O período é uma lista dos últimos doze meses em vez de dois campos de data:
 * na prática a pergunta é sempre "quanto entrou em setembro", não um intervalo
 * arbitrário - e um select acerta de primeira, sem digitar data.
 */

import { FilterBar, FilterSelect } from "@/components/ui/filter-bar";
import { formatMonthLabel, lastMonths } from "@/lib/dates";
import { PAYMENT_METHOD_OPTIONS, toSelectOptions } from "@/lib/domain/enums";
import type { FinanceFilters as Filters } from "@/lib/schemas/work";

const STATUS_OPTIONS = [
  { value: "PENDING", label: "A receber" },
  { value: "PAID", label: "Recebido" },
  { value: "OVERDUE", label: "Atrasado" },
  { value: "CANCELLED", label: "Cancelado" },
];

export function FinanceFilters({
  filters,
  clients,
  projects,
  tab,
}: {
  filters: Filters;
  clients: ReadonlyArray<{ id: string; name: string; company: string | null }>;
  projects: ReadonlyArray<{ id: string; name: string }>;
  tab: string;
}) {
  const months = lastMonths(12).reverse().map((month) => ({
    value: `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`,
    label: formatMonthLabel(month),
  }));

  const isExpenses = tab === "custos";

  return (
    <FilterBar
      action="/financeiro"
      showSearch={false}
      hasActiveFilters={Boolean(
        filters.month || filters.clientId || filters.projectId || filters.status || filters.method,
      )}
    >
      {/* A aba escolhida precisa sobreviver ao filtrar. */}
      {tab !== "recebimentos" ? <input type="hidden" name="tab" value={tab} /> : null}

      <FilterSelect
        name="month"
        label="Período"
        value={filters.month}
        options={months}
        allLabel="Todo o período"
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
        name="projectId"
        label="Projeto"
        value={filters.projectId}
        options={projects.map((project) => ({ value: project.id, label: project.name }))}
      />
      {isExpenses ? null : (
        <>
          <FilterSelect
            name="status"
            label="Situação"
            value={filters.status}
            options={STATUS_OPTIONS}
          />
          <FilterSelect
            name="method"
            label="Forma"
            value={filters.method}
            options={toSelectOptions(PAYMENT_METHOD_OPTIONS)}
          />
        </>
      )}
    </FilterBar>
  );
}
