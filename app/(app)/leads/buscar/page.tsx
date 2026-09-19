import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AlertTriangle } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/ui/feedback";
import { LeadsResults } from "@/features/leads/leads-results";
import { SearchForm } from "@/features/search/search-form";
import { buildLeadFiltersQuery, parseLeadFilters, type LeadFilters } from "@/lib/validation";
import { findSearchById } from "@/server/repositories/search-repository";
import { leadSourceLabel } from "@/types/lead";
import type { SearchHistoryItem } from "@/types/search";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Buscar leads" };

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

function SearchSummary({ search }: { search: SearchHistoryItem }) {
  const place = [[search.city, ...search.extraCities].filter(Boolean).join(", "), search.state]
    .filter(Boolean)
    .join("/");
  const bySource = Object.entries(search.sourceCounts)
    .map(([source, count]) => `${count} em ${leadSourceLabel(source)}`)
    .join(" · ");

  return (
    <p className="text-xs text-ink-muted">
      Resultados de <span className="font-medium text-ink">{search.term}</span>
      {place ? ` em ${place}` : ""} · {search.resultsCount} empresas reais
      {bySource ? ` (${bySource})` : ""} · coletados em {dateFormatter.format(search.lastRunAt)}
      {search.cacheHits > 0 ? ` · ${search.cacheHits} repetições servidas pelo cache` : ""}
    </p>
  );
}

function SourceWarnings({ warnings }: { warnings: readonly string[] }) {
  if (warnings.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1.5 rounded-md border border-warning/25 bg-warning-soft px-3 py-2.5 text-sm text-warning">
      {warnings.map((warning) => (
        <li key={warning} className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span className="wrap-break-word">{warning}</span>
        </li>
      ))}
    </ul>
  );
}

function hasQualificationFilters(filters: LeadFilters): boolean {
  return (
    filters.site !== "any" ||
    filters.phone !== "any" ||
    filters.whatsapp !== "any" ||
    filters.instagram !== "any" ||
    filters.email !== "any" ||
    filters.minScore !== undefined ||
    filters.status !== undefined
  );
}

export default async function SearchPage({ searchParams }: PageProps<"/leads/buscar">) {
  const params = await searchParams;
  const filters = parseLeadFilters(params);
  const lastSearch = filters.searchId ? await findSearchById(filters.searchId) : null;

  const found = lastSearch?.resultsCount ?? 0;
  const filtered = hasQualificationFilters(filters);
  const withoutFilters = filters.searchId
    ? `/leads/buscar${buildLeadFiltersQuery({ searchId: filters.searchId, max: filters.max })}`
    : "/leads/buscar";

  const emptyTitle =
    found === 0
      ? "Nenhuma empresa real encontrada"
      : filtered
        ? `A busca encontrou ${found} empresas, mas seus filtros deixaram 0`
        : "Nenhuma empresa real para mostrar";
  const emptyDescription =
    found === 0
      ? "As fontes não têm estabelecimentos desse segmento nesta região. Inclua cidades vizinhas, tente um segmento parecido ou importe a cidade da Receita Federal."
      : "Veja todas sem filtro ou relaxe um filtro e envie de novo - o cache responde sem nova consulta.";

  return (
    <>
      <PageHeader
        title="Buscar leads"
        description="Empresas reais do OpenStreetMap e da Receita Federal, sem API paga. O que a fonte não informa fica em branco - nada é inventado."
      />

      <Panel className="p-4 md:p-5">
        <SearchForm filters={filters} lastSearch={lastSearch} />
      </Panel>

      {filters.searchId ? (
        <section className="flex flex-col gap-3">
          {lastSearch ? <SearchSummary search={lastSearch} /> : null}
          {lastSearch ? <SourceWarnings warnings={lastSearch.warnings} /> : null}
          <Suspense fallback={<p className="text-sm text-ink-muted">Carregando resultados...</p>}>
            <LeadsResults
              filters={filters}
              basePath="/leads/buscar"
              emptyTitle={emptyTitle}
              emptyDescription={emptyDescription}
              emptyAction={
                found > 0 && filtered ? (
                  <Link href={withoutFilters} className={buttonClasses("primary", "sm")}>
                    Ver as {found} empresas sem filtro
                  </Link>
                ) : undefined
              }
            />
          </Suspense>
        </section>
      ) : null}
    </>
  );
}
