import Link from "next/link";
import { Download } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { EmptyState, ErrorNotice, Panel } from "@/components/ui/feedback";
import { LeadsTable } from "@/features/leads/leads-table";
import { APP_CONFIG } from "@/lib/config/app-config";
import { userMessage } from "@/lib/errors";
import { buildLeadFiltersQuery, type LeadFilters } from "@/lib/validation";
import { findLeads, type LeadPage } from "@/server/repositories/lead-repository";

type LoadResult = { ok: true; page: LeadPage } | { ok: false; message: string };

/** Busca isolada da renderizacao: erro de banco vira mensagem, nunca stack trace. */
async function loadLeads(filters: LeadFilters): Promise<LoadResult> {
  try {
    return { ok: true, page: await findLeads(filters) };
  } catch (error) {
    return { ok: false, message: userMessage(error) };
  }
}

/** Filtros ativos viajam junto com a exportacao, como campos escondidos. */
function FilterFields({ filters }: { filters: LeadFilters }) {
  const query = buildLeadFiltersQuery(filters, { limit: undefined });
  const entries = [...new URLSearchParams(query.replace(/^\?/, "")).entries()];

  return (
    <>
      {entries.map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
    </>
  );
}

/**
 * Lista paginada de leads. Le sempre do banco (nunca do provider) e traz
 * apenas o tamanho de pagina configurado - "Carregar mais" aumenta o limite.
 *
 * A tabela vive dentro de um formulario GET que aponta para a exportacao:
 * marcar leads e clicar em exportar baixa so os marcados, sem JavaScript.
 */
export async function LeadsResults({
  filters,
  basePath,
  emptyTitle = "Nenhum lead encontrado",
  emptyDescription = "Ajuste os filtros ou faca uma nova busca para trazer empresas.",
}: {
  filters: LeadFilters;
  basePath: string;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const result = await loadLeads(filters);
  if (!result.ok) return <ErrorNotice message={result.message} />;

  const { items, total, hasMore } = result.page;

  if (items.length === 0) {
    return (
      <Panel>
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          action={
            <Link href="/buscar" className={buttonClasses("secondary", "sm")}>
              Buscar empresas
            </Link>
          }
        />
      </Panel>
    );
  }

  const nextLimit = filters.limit + APP_CONFIG.pagination.loadMoreStep;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-ink-muted">
        Mostrando <span className="tabular-nums">{items.length}</span> de{" "}
        <span className="tabular-nums">{total}</span> leads
      </p>

      <form method="get" action="/api/leads/export" className="flex flex-col gap-3">
        <FilterFields filters={filters} />

        <Panel className="overflow-hidden">
          <LeadsTable leads={items} selectable />
        </Panel>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button type="submit" size="sm">
            <Download className="size-3.5" aria-hidden />
            Exportar selecionados
          </Button>
          <span className="text-xs text-ink-subtle">
            Sem nenhum marcado, exporta todos os leads filtrados.
          </span>
        </div>
      </form>

      {hasMore ? (
        <div className="flex justify-center">
          <Link
            href={`${basePath}${buildLeadFiltersQuery(filters, { limit: nextLimit })}`}
            className={buttonClasses("secondary", "sm")}
          >
            Carregar mais
          </Link>
        </div>
      ) : null}
    </div>
  );
}
