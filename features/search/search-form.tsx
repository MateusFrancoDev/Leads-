"use client";

/**
 * Formulário de busca. Client Component por causa do estado de envio
 * (useActionState). A busca só acontece no submit, nunca a cada tecla: digitar
 * não gera nenhuma consulta ao OpenStreetMap.
 */

import { useActionState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorNotice } from "@/components/ui/feedback";
import { Field, Input, OptionsField, Select, TriStateField } from "@/components/ui/form";
import { listCategoryLabels } from "@/lib/leads/category-mapper";
import {
  DEFAULT_SEARCH_QUANTITY,
  MAX_SEARCH_QUANTITY,
  SITE_FILTER_LABELS,
  SITE_FILTER_OPTIONS,
  WHATSAPP_FILTER_LABELS,
  WHATSAPP_FILTER_OPTIONS,
  toSelectOptions,
} from "@/lib/leads/filter-options";
import { BRAZILIAN_STATE_CODES } from "@/lib/normalize";
import type { LeadFilters } from "@/lib/validation";
import { runSearchAction } from "@/server/actions/search-actions";
import type { SearchHistoryItem } from "@/types/search";
import { initialSearchActionState } from "@/server/actions/leads-action-state";

const CATEGORY_SUGGESTIONS = listCategoryLabels();
const SITE_OPTIONS = toSelectOptions(SITE_FILTER_OPTIONS, SITE_FILTER_LABELS);
const WHATSAPP_OPTIONS = toSelectOptions(WHATSAPP_FILTER_OPTIONS, WHATSAPP_FILTER_LABELS);

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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Field
          label="Segmento"
          htmlFor="query"
          error={errors.query}
          className="sm:col-span-2"
          hint="Ex.: barbearia, dentista, pet shop"
        >
          <Input
            id="query"
            name="query"
            required
            list="segment-suggestions"
            defaultValue={lastSearch?.term ?? ""}
            placeholder="Barbearia"
            aria-invalid={Boolean(errors.query)}
            aria-describedby={errors.query ? "query-error" : undefined}
          />
          <datalist id="segment-suggestions">
            {CATEGORY_SUGGESTIONS.map((label) => (
              <option key={label} value={label} />
            ))}
          </datalist>
        </Field>
        <Field label="Cidade" htmlFor="city" error={errors.city}>
          <Input
            id="city"
            name="city"
            required
            defaultValue={lastSearch?.city ?? ""}
            placeholder="Osasco"
            aria-invalid={Boolean(errors.city)}
            aria-describedby={errors.city ? "city-error" : undefined}
          />
        </Field>
        <Field label="Estado" htmlFor="state" error={errors.state}>
          <Select id="state" name="state" required defaultValue={lastSearch?.state ?? "SP"}>
            {BRAZILIAN_STATE_CODES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Cidades vizinhas"
          htmlFor="nearbyCities"
          error={errors.nearbyCities}
          className="sm:col-span-2 lg:col-span-4"
          hint="Opcional. Mesma UF, separadas por vírgula (ex.: Barueri, Carapicuíba). Até 5."
        >
          <Input
            id="nearbyCities"
            name="nearbyCities"
            defaultValue={lastSearch?.extraCities.join(", ") ?? ""}
            placeholder="Barueri, Carapicuíba"
          />
        </Field>
        <Field label="Quantidade" htmlFor="limit" error={errors.limit}>
          <Input
            id="limit"
            name="limit"
            type="number"
            min={1}
            max={MAX_SEARCH_QUANTITY}
            defaultValue={filters.max ?? DEFAULT_SEARCH_QUANTITY}
          />
        </Field>
      </div>

      <fieldset className="flex flex-col gap-3 border-t border-line pt-4">
        <legend className="sr-only">Filtros de qualificação</legend>
        <p className="text-xs font-medium text-ink-muted">
          Qualificação{" "}
          <span className="font-normal text-ink-subtle">(aplicada aos resultados, sem consulta extra)</span>
        </p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <OptionsField name="site" label="Status do site" defaultValue={filters.site} options={SITE_OPTIONS} />
          <TriStateField name="phone" label="Possui telefone" defaultValue={filters.phone} />
          <OptionsField
            name="whatsapp"
            label="WhatsApp"
            defaultValue={filters.whatsapp}
            options={WHATSAPP_OPTIONS}
          />
          <TriStateField name="instagram" label="Possui Instagram" defaultValue={filters.instagram} />
          <TriStateField name="email" label="Possui e-mail" defaultValue={filters.email} />
          <Field label="Score mínimo" htmlFor="minScore">
            <Input
              id="minScore"
              name="minScore"
              type="number"
              min={0}
              max={100}
              defaultValue={filters.minScore ?? ""}
              placeholder="30"
            />
          </Field>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" disabled={pending}>
          <Search className="size-4" aria-hidden />
          {pending ? "Buscando..." : "Buscar leads"}
        </Button>
        <p className="text-xs text-ink-subtle">
          Fontes: OpenStreetMap e Receita Federal (cidades importadas). Só empresas reais; o que a
          fonte não informa fica em branco. Buscas repetidas são respondidas pelo banco.
        </p>
      </div>
    </form>
  );
}
