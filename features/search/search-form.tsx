"use client";

/**
 * Formulario de busca. Client Component por causa do estado de envio
 * (useActionState) - a busca so acontece no submit, nunca a cada tecla
 * digitada, de modo que digitar nao gasta requisicao de API.
 */

import { useActionState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorNotice } from "@/components/ui/feedback";
import { Field, Input, Select, TriStateField } from "@/components/ui/form";
import type { LeadFilters } from "@/lib/validation";
import { initialSearchActionState, runSearchAction } from "@/server/actions/search-actions";
import { LEAD_STATUS_LABELS, LEAD_STATUS_ORDER } from "@/types/lead";
import type { SearchHistoryItem } from "@/types/search";

export function SearchForm({
  filters,
  lastSearch,
}: {
  filters: LeadFilters;
  lastSearch: SearchHistoryItem | null;
}) {
  const [state, formAction, pending] = useActionState(runSearchAction, initialSearchActionState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state.status === "error" && state.message ? <ErrorNotice message={state.message} /> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field
          label="Ramo / nicho"
          htmlFor="term"
          error={errors.term}
          className="sm:col-span-2 lg:col-span-2"
        >
          <Input
            id="term"
            name="term"
            required
            defaultValue={lastSearch?.term ?? ""}
            placeholder="Clinicas de estetica"
            aria-invalid={Boolean(errors.term)}
            aria-describedby={errors.term ? "term-error" : undefined}
          />
        </Field>
        <Field label="Palavra-chave" htmlFor="keyword" error={errors.keyword}>
          <Input
            id="keyword"
            name="keyword"
            defaultValue={lastSearch?.keyword ?? ""}
            placeholder="Opcional"
          />
        </Field>
        <Field label="Raio (km)" htmlFor="radiusKm" error={errors.radiusKm}>
          <Input
            id="radiusKm"
            name="radiusKm"
            type="number"
            min={1}
            max={50}
            defaultValue={lastSearch?.radiusMeters ? lastSearch.radiusMeters / 1000 : ""}
            placeholder="10"
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Cidade" htmlFor="city" error={errors.city}>
          <Input id="city" name="city" defaultValue={lastSearch?.city ?? ""} placeholder="Osasco" />
        </Field>
        <Field label="Estado" htmlFor="state" error={errors.state}>
          <Input id="state" name="state" defaultValue={lastSearch?.state ?? ""} placeholder="SP" />
        </Field>
        <Field label="Bairro" htmlFor="neighborhood" error={errors.neighborhood}>
          <Input
            id="neighborhood"
            name="neighborhood"
            defaultValue={lastSearch?.neighborhood ?? ""}
            placeholder="Centro"
          />
        </Field>
      </div>

      <fieldset className="flex flex-col gap-3 border-t border-line pt-4">
        <legend className="sr-only">Filtros de qualificacao</legend>
        <p className="text-xs font-medium text-ink-muted">
          Qualificacao{" "}
          <span className="font-normal text-ink-subtle">
            (aplicada aos resultados, sem custo extra de API)
          </span>
        </p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <TriStateField name="website" label="Website proprio" defaultValue={filters.website} />
          <TriStateField name="phone" label="Telefone" defaultValue={filters.phone} />
          <TriStateField name="whatsapp" label="WhatsApp" defaultValue={filters.whatsapp} />
          <TriStateField name="instagram" label="Instagram" defaultValue={filters.instagram} />

          <Field label="Nota minima" htmlFor="minRating">
            <Input
              id="minRating"
              name="minRating"
              type="number"
              min={0}
              max={5}
              step={0.1}
              defaultValue={filters.minRating ?? ""}
              placeholder="4"
            />
          </Field>
          <Field label="Avaliacoes (min)" htmlFor="minReviews">
            <Input
              id="minReviews"
              name="minReviews"
              type="number"
              min={0}
              defaultValue={filters.minReviews ?? ""}
              placeholder="20"
            />
          </Field>
          <Field label="Score minimo" htmlFor="minScore">
            <Input
              id="minScore"
              name="minScore"
              type="number"
              min={0}
              max={100}
              defaultValue={filters.minScore ?? ""}
              placeholder="70"
            />
          </Field>
          <Field label="Status" htmlFor="status">
            <Select id="status" name="status" defaultValue={filters.status ?? ""}>
              <option value="">Todos</option>
              {LEAD_STATUS_ORDER.map((status) => (
                <option key={status} value={status}>
                  {LEAD_STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </fieldset>

      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={pending}>
          <Search className="size-4" aria-hidden />
          {pending ? "Buscando..." : "Buscar empresas"}
        </Button>
        <p className="text-xs text-ink-subtle">
          Buscas repetidas sao respondidas pelo cache do banco.
        </p>
      </div>
    </form>
  );
}
