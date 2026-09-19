import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState, ErrorNotice, PageHeader, Panel } from "@/components/ui/feedback";
import { LeadsTable } from "@/features/leads/leads-table";
import { userMessage } from "@/lib/errors";
import { findTopOpportunities, getLeadStats } from "@/server/repositories/lead-repository";
import { getUsageStats, listRecentSearches, type UsageStats } from "@/server/repositories/search-repository";
import { leadSourceLabel, type LeadStats } from "@/types/lead";
import type { SearchHistoryItem } from "@/types/search";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="bg-surface px-4 py-3.5">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-ink">{value}</dd>
      {hint ? <p className="mt-0.5 text-xs text-ink-subtle">{hint}</p> : null}
    </div>
  );
}

function StatsGrid({ stats }: { stats: LeadStats }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line lg:grid-cols-4">
      <Stat label="Total de leads" value={stats.total} />
      <Stat label="Sem site conhecido" value={stats.withoutKnownWebsite} hint="Não informado na fonte" />
      <Stat label="Score alto" value={stats.highScore} hint="70 ou mais" />
      <Stat label="Novos" value={stats.new} />
      <Stat label="Contatados" value={stats.contacted} />
      <Stat label="Interessados" value={stats.interested} />
      <Stat label="Clientes" value={stats.clients} />
      <Stat label="Sites lidos" value={stats.enriched} hint="Crawler do site oficial" />
    </dl>
  );
}

/** Painel de custo: o cache só vale se der para medir o quanto economizou. */
function UsageGrid({ usage }: { usage: UsageStats }) {
  const savedPercent = usage.runs > 0 ? Math.round((usage.cacheHits / usage.runs) * 100) : 0;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-ink">Consultas externas</h2>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line lg:grid-cols-4">
        <Stat label="Pesquisas distintas" value={usage.searches} />
        <Stat label="Execuções" value={usage.runs} hint="Incluindo repetições" />
        <Stat label="Respondidas pelo cache" value={usage.cacheHits} hint={`${savedPercent}% das execuções`} />
        <Stat label="Requisições externas" value={usage.providerRequests} hint="OpenStreetMap, gratuitas" />
        <Stat label="Sites analisados" value={usage.analyzedWebsites} hint="Sem custo de API" />
        <Stat label="Análises de IA" value={usage.aiAnalyses} hint="Sob demanda" />
        <Stat
          label="Custo estimado de IA"
          value={`US$ ${usage.aiCostUsd.toFixed(2)}`}
          hint="Acumulado"
        />
      </dl>
    </section>
  );
}

function RecentSearches({ searches }: { searches: readonly SearchHistoryItem[] }) {
  if (searches.length === 0) {
    return (
      <EmptyState
        title="Nenhuma pesquisa ainda"
        description="Faça a primeira busca para começar a montar sua base de leads."
      />
    );
  }

  return (
    <ul className="divide-y divide-line">
      {searches.map((search) => (
        <li key={search.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
          <div className="min-w-0">
            <Link
              href={`/leads/buscar?searchId=${search.id}`}
              className="block truncate text-sm text-ink hover:text-accent hover:underline"
            >
              {search.term}
              {search.city ? ` · ${search.city}` : ""}
              {search.state ? `/${search.state}` : ""}
            </Link>
            <p className="mt-0.5 text-xs text-ink-subtle">
              {dateFormatter.format(search.lastRunAt)} · {search.resultsCount} leads ·{" "}
              {leadSourceLabel(search.provider)}
            </p>
          </div>
          <span className="shrink-0 text-xs tabular-nums text-ink-subtle">
            {search.requestCount} req
          </span>
        </li>
      ))}
    </ul>
  );
}

export default async function DashboardPage() {
  let stats: LeadStats;
  let searches: SearchHistoryItem[];
  let usage: UsageStats;
  let opportunities: Awaited<ReturnType<typeof findTopOpportunities>>;

  try {
    [stats, searches, usage, opportunities] = await Promise.all([
      getLeadStats(),
      listRecentSearches(5),
      getUsageStats(),
      findTopOpportunities(5),
    ]);
  } catch (error) {
    return (
      <>
        <PageHeader title="Dashboard" description="Visão geral da sua base de leads." />
        <ErrorNotice message={userMessage(error)} />
        <p className="text-sm text-ink-muted">
          Confira <code className="font-mono text-xs">DATABASE_URL</code> no arquivo{" "}
          <code className="font-mono text-xs">.env</code> e rode as migrations com{" "}
          <code className="font-mono text-xs">npm run db:migrate</code>.
        </p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Visão geral da sua base de leads."
        actions={
          <Link href="/leads/buscar" className={buttonClasses("primary", "sm")}>
            Buscar leads
          </Link>
        }
      />

      <StatsGrid stats={stats} />

      <UsageGrid usage={usage} />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-ink">Últimas pesquisas</h2>
          <Panel className="overflow-hidden">
            <RecentSearches searches={searches} />
          </Panel>
        </section>

        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-ink">Melhores oportunidades</h2>
            <Link href="/leads?sort=score" className="text-xs text-accent hover:underline">
              Ver todos
            </Link>
          </div>
          <Panel className="overflow-hidden">
            {opportunities.length > 0 ? (
              <LeadsTable leads={opportunities} />
            ) : (
              <EmptyState
                title="Sem leads qualificados ainda"
                description="Depois da primeira busca, os melhores leads aparecem aqui."
              />
            )}
          </Panel>
        </section>
      </div>
    </>
  );
}
