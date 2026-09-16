import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, TriStateField } from "@/components/ui/form";
import { LEAD_SORT_LABELS, LEAD_SORT_OPTIONS, type LeadFilters } from "@/lib/validation";
import { LEAD_STATUS_LABELS, LEAD_STATUS_ORDER } from "@/types/lead";

/**
 * Filtros da tabela. Formulario GET puro: os filtros viram query string e a
 * pagina e renderizada no servidor - nenhum JavaScript enviado ao navegador.
 */
export function LeadsFiltersForm({
  action,
  filters,
}: {
  action: string;
  filters: LeadFilters;
}) {
  return (
    <form action={action} method="get" className="flex flex-col gap-4">
      {filters.searchId ? <input type="hidden" name="searchId" value={filters.searchId} /> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Palavra-chave" htmlFor="filter-q" className="sm:col-span-2 lg:col-span-1">
          <Input
            id="filter-q"
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Nome ou ramo"
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

      <details className="group" open={Boolean(filters.minScore ?? filters.minRating ?? filters.status)}>
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-ink">
          <SlidersHorizontal className="size-3.5" aria-hidden />
          Filtros avancados
        </summary>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <TriStateField name="website" label="Website proprio" defaultValue={filters.website} />
          <TriStateField name="phone" label="Telefone" defaultValue={filters.phone} />
          <TriStateField name="whatsapp" label="WhatsApp" defaultValue={filters.whatsapp} />
          <TriStateField name="instagram" label="Instagram" defaultValue={filters.instagram} />
          <TriStateField name="email" label="E-mail" defaultValue={filters.email} />

          <Field label="Nota minima" htmlFor="filter-minRating">
            <Input
              id="filter-minRating"
              name="minRating"
              type="number"
              min={0}
              max={5}
              step={0.1}
              defaultValue={filters.minRating ?? ""}
              placeholder="4"
            />
          </Field>
          <Field label="Avaliacoes (min)" htmlFor="filter-minReviews">
            <Input
              id="filter-minReviews"
              name="minReviews"
              type="number"
              min={0}
              defaultValue={filters.minReviews ?? ""}
              placeholder="20"
            />
          </Field>
          <Field label="Avaliacoes (max)" htmlFor="filter-maxReviews">
            <Input
              id="filter-maxReviews"
              name="maxReviews"
              type="number"
              min={0}
              defaultValue={filters.maxReviews ?? ""}
            />
          </Field>
          <Field label="Score minimo" htmlFor="filter-minScore">
            <Input
              id="filter-minScore"
              name="minScore"
              type="number"
              min={0}
              max={100}
              defaultValue={filters.minScore ?? ""}
              placeholder="70"
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
