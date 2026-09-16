import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader, Panel } from "@/components/ui/feedback";
import { LeadsResults } from "@/features/leads/leads-results";
import { SearchForm } from "@/features/search/search-form";
import { parseLeadFilters } from "@/lib/validation";
import { findSearchById } from "@/server/repositories/search-repository";
import type { SearchHistoryItem } from "@/types/search";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Buscar leads" };

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

function SearchSummary({ search }: { search: SearchHistoryItem }) {
  const place = [search.city, search.state].filter(Boolean).join("/");
  return (
    <p className="text-xs text-ink-muted">
      Resultados de <span className="font-medium text-ink">{search.term}</span>
      {place ? ` em ${place}` : ""} · coletados em {dateFormatter.format(search.lastRunAt)} ·{" "}
      {search.requestCount} requisicoes usadas
      {search.cacheHits > 0 ? ` · ${search.cacheHits} repeticoes servidas pelo cache` : ""}
    </p>
  );
}

export default async function SearchPage({ searchParams }: PageProps<"/buscar">) {
  const params = await searchParams;
  const filters = parseLeadFilters(params);
  const lastSearch = filters.searchId ? await findSearchById(filters.searchId) : null;

  return (
    <>
      <PageHeader
        title="Buscar leads"
        description="Escolha o nicho e a regiao. Buscas repetidas usam o cache e nao gastam API."
      />

      <Panel className="p-4 md:p-5">
        <SearchForm filters={filters} lastSearch={lastSearch} />
      </Panel>

      {filters.searchId ? (
        <section className="flex flex-col gap-3">
          {lastSearch ? <SearchSummary search={lastSearch} /> : null}
          <Suspense fallback={<p className="text-sm text-ink-muted">Carregando resultados...</p>}>
            <LeadsResults
              filters={filters}
              basePath="/buscar"
              emptyTitle="Nenhuma empresa atende a esses filtros"
              emptyDescription="A busca trouxe resultados, mas os filtros de qualificacao excluiram todos. Relaxe um filtro e envie de novo - o cache responde sem custo."
            />
          </Suspense>
        </section>
      ) : null}
    </>
  );
}
