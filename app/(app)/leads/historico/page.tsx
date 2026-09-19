import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorNotice, PageHeader, Panel } from "@/components/ui/feedback";
import { userMessage } from "@/lib/errors";
import { listRecentSearches } from "@/server/repositories/search-repository";
import { leadSourceLabel } from "@/types/lead";
import type { SearchHistoryItem } from "@/types/search";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Histórico" };

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

function SearchRow({ search }: { search: SearchHistoryItem }) {
  const place = [search.city, search.state].filter(Boolean).join("/");

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <Link
          href={`/leads/buscar?searchId=${search.id}`}
          className="text-sm font-medium text-ink hover:text-accent hover:underline"
        >
          {search.term}
          {place ? ` · ${place}` : ""}
        </Link>
        <p className="mt-0.5 text-xs text-ink-subtle">
          {dateFormatter.format(search.lastRunAt)} · fonte {leadSourceLabel(search.provider)} ·{" "}
          {search.runCount} execuções
        </p>
      </div>

      <div className="flex items-center gap-4 text-xs text-ink-muted">
        <span className="tabular-nums">
          {search.resultsCount} <span className="text-ink-subtle">leads</span>
        </span>
        <span className="tabular-nums">
          {search.requestCount} <span className="text-ink-subtle">requisições</span>
        </span>
        <span className="tabular-nums">
          {search.cacheHits} <span className="text-ink-subtle">via cache</span>
        </span>
        <Badge tone={search.isCacheFresh ? "positive" : "neutral"}>
          {search.isCacheFresh ? "Cache válido" : "Cache expirado"}
        </Badge>
      </div>
    </li>
  );
}

export default async function HistoryPage() {
  let searches: SearchHistoryItem[];
  try {
    searches = await listRecentSearches(50);
  } catch (error) {
    return (
      <>
        <PageHeader title="Histórico" />
        <ErrorNotice message={userMessage(error)} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Histórico"
        description="Toda pesquisa feita, quantos leads reais trouxe e quantas consultas ao OpenStreetMap usou."
      />

      <Panel className="overflow-hidden">
        {searches.length > 0 ? (
          <ul className="divide-y divide-line">
            {searches.map((search) => (
              <SearchRow key={search.id} search={search} />
            ))}
          </ul>
        ) : (
          <EmptyState
            title="Nenhuma pesquisa registrada"
            description="Assim que você buscar empresas, o histórico aparece aqui com o custo de cada consulta."
          />
        )}
      </Panel>
    </>
  );
}
