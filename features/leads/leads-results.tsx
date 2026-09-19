import Link from "next/link";
import type { ReactNode } from "react";
import { Download } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { EmptyState, ErrorNotice, Panel } from "@/components/ui/feedback";
import { AiBatchBar } from "@/features/leads/ai-batch-bar";
import { LeadsTable } from "@/features/leads/leads-table";
import { APP_CONFIG } from "@/lib/config/app-config";
import { userMessage } from "@/lib/errors";
import { buildLeadFiltersQuery, type LeadFilters } from "@/lib/validation";
import { isAiEnabled } from "@/server/ai";
import { findLeads, type LeadPage } from "@/server/repositories/lead-repository";
import { MAX_BATCH_SIZE } from "@/server/services/lead-ai-service";

type LoadResult = { ok: true; page: LeadPage } | { ok: false; message: string };

/** Busca isolada da renderização: erro de banco vira mensagem, nunca stack trace. */
async function loadLeads(filters: LeadFilters): Promise<LoadResult> {
  try {
    return { ok: true, page: await findLeads(filters) };
  } catch (error) {
    return { ok: false, message: userMessage(error) };
  }
}

/** Filtros ativos viajam junto com a exportação, como campos escondidos. */
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
 * Lista paginada de leads. Lê sempre do banco (nunca do provider) e traz
 * apenas o tamanho de página configurado - "Carregar mais" aumenta o limite.
 *
 * A tabela vive dentro de um formulário GET que aponta para a exportação:
 * marcar leads e clicar em exportar baixa só os marcados, sem JavaScript.
 */
export async function LeadsResults({
  filters,
  basePath,
  emptyTitle = "Nenhum lead encontrado",
  emptyDescription = "Ajuste os filtros ou faça uma nova busca para trazer empresas.",
  emptyAction,
}: {
  filters: LeadFilters;
  basePath: string;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Ação principal do estado vazio; padrão: ir para a busca. */
  emptyAction?: ReactNode;
}) {
  const result = await loadLeads(filters);
  if (!result.ok) return <ErrorNotice message={result.message} />;

  // Sem provider de IA configurado, a barra de lote simplesmente não aparece.
  const aiEnabled = isAiEnabled();

  const { items, total, hasMore } = result.page;

  if (items.length === 0) {
    return (
      <Panel>
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          action={
            emptyAction ?? (
              <Link href="/leads/buscar" className={buttonClasses("secondary", "sm")}>
                Buscar empresas
              </Link>
            )
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
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm">
              <Download className="size-3.5" aria-hidden />
              Exportar selecionados
            </Button>
            {/* Mesma seleção da exportação: marcar uma vez serve para as duas ações. */}
            {aiEnabled ? <AiBatchBar maxBatchSize={MAX_BATCH_SIZE} /> : null}
          </div>
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
