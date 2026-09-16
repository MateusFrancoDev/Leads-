import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, OptionsField, Select, TriStateField } from "@/components/ui/form";
import {
  SITE_FILTER_LABELS,
  SITE_FILTER_OPTIONS,
  WHATSAPP_FILTER_LABELS,
  WHATSAPP_FILTER_OPTIONS,
  toSelectOptions,
} from "@/lib/leads/filter-options";
import { LEAD_SORT_LABELS, LEAD_SORT_OPTIONS, type LeadFilters } from "@/lib/validation";
import { LEAD_STATUS_LABELS, LEAD_STATUS_ORDER } from "@/types/lead";

const SITE_OPTIONS = toSelectOptions(SITE_FILTER_OPTIONS, SITE_FILTER_LABELS);
const WHATSAPP_OPTIONS = toSelectOptions(WHATSAPP_FILTER_OPTIONS, WHATSAPP_FILTER_LABELS);

/**
 * Filtros da tabela. Formulário GET puro: os filtros viram query string e a
 * página e renderizada no servidor - nenhum JavaScript enviado ao navegador.
 */
export function LeadsFiltersForm({
  action,
  filters,
}: {
  action: string;
  filters: LeadFilters;
}) {
  const advancedActive =
    filters.site !== "any" ||
    filters.phone !== "any" ||
    filters.whatsapp !== "any" ||
    filters.instagram !== "any" ||
    filters.email !== "any" ||
    filters.minScore !== undefined ||
    filters.status !== undefined;

  return (
    <form action={action} method="get" className="flex flex-col gap-4">
      {filters.searchId ? <input type="hidden" name="searchId" value={filters.searchId} /> : null}
      {filters.max ? <input type="hidden" name="max" value={filters.max} /> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Palavra-chave" htmlFor="filter-q" className="sm:col-span-2 lg:col-span-1">
          <Input
            id="filter-q"
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Nome ou segmento"
          />
        </Field>
        <Field label="Cidade" htmlFor="filter-city">
          <Input id="filter-city" name="city" defaultValue={filters.city ?? ""} placeholder="Osasco" />
        </Field>
        <Field label="Estado" htmlFor="filter-state">
          <Input
            id="filter-state"
            name="state"
            defaultValue={filters.state ?? ""}
            placeholder="SP"
            maxLength={40}
          />
        </Field>
        <Field label="Ordenar por" htmlFor="filter-sort">
          <Select id="filter-sort" name="sort" defaultValue={filters.sort}>
            {LEAD_SORT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {LEAD_SORT_LABELS[option]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <details className="group" open={advancedActive}>
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-ink">
          <SlidersHorizontal className="size-3.5" aria-hidden />
          Filtros avançados
        </summary>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <OptionsField name="site" label="Status do site" defaultValue={filters.site} options={SITE_OPTIONS} />
          <TriStateField name="phone" label="Telefone" defaultValue={filters.phone} />
          <OptionsField
            name="whatsapp"
            label="WhatsApp"
            defaultValue={filters.whatsapp}
            options={WHATSAPP_OPTIONS}
          />
          <TriStateField name="instagram" label="Instagram" defaultValue={filters.instagram} />
          <TriStateField name="email" label="E-mail" defaultValue={filters.email} />

          <Field label="Score mínimo" htmlFor="filter-minScore">
            <Input
              id="filter-minScore"
              name="minScore"
              type="number"
              min={0}
              max={100}
              defaultValue={filters.minScore ?? ""}
              placeholder="30"
            />
          </Field>
          <Field label="Status" htmlFor="filter-status">
            <Select id="filter-status" name="status" defaultValue={filters.status ?? ""}>
              <option value="">Todos</option>
              {LEAD_STATUS_ORDER.map((status) => (
                <option key={status} value={status}>
                  {LEAD_STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </details>

      <div className="flex items-center gap-2">
        <Button type="submit" variant="primary" size="sm">
          Aplicar filtros
        </Button>
        <a href={action} className="text-xs text-ink-muted hover:text-ink hover:underline">
          Limpar
        </a>
      </div>
    </form>
  );
}
