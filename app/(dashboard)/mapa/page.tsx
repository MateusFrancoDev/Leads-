import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState, ErrorNotice, PageHeader, Panel } from "@/components/ui/feedback";
import { LeadsFiltersForm } from "@/features/leads/leads-filters-form";
import { LeadsMap } from "@/features/leads/leads-map";
import { userMessage } from "@/lib/errors";
import { parseLeadFilters } from "@/lib/validation";
import { findLeadsForMap } from "@/server/repositories/lead-repository";
import type { LeadMapPoint } from "@/types/lead";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Mapa" };

/** Teto de marcadores: acima disso o navegador sofre e o mapa vira mancha. */
const MAX_POINTS = 300;

type LoadResult =
  | { ok: true; points: LeadMapPoint[]; total: number; withoutCoordinates: number }
  | { ok: false; message: string };

async function loadPoints(
  filters: ReturnType<typeof parseLeadFilters>,
): Promise<LoadResult> {
  try {
    const result = await findLeadsForMap(filters, MAX_POINTS);
    return { ok: true, ...result };
  } catch (error) {
    return { ok: false, message: userMessage(error) };
  }
}

export default async function MapPage({ searchParams }: PageProps<"/mapa">) {
  const filters = parseLeadFilters(await searchParams);
  const result = await loadPoints(filters);

  return (
    <>
      <PageHeader
        title="Mapa"
        description="Onde estão os potenciais clientes. Os mesmos filtros da tabela valem aqui."
      />

      <Panel className="p-4 md:p-5">
        <LeadsFiltersForm action="/mapa" filters={filters} />
      </Panel>

      {!result.ok ? (
        <ErrorNotice message={result.message} />
      ) : result.points.length === 0 ? (
        <Panel>
          <EmptyState
            title="Nenhum lead com coordenadas"
            description="Os leads aparecem no mapa assim que a busca trouxer latitude e longitude."
            action={
              <Link href="/buscar" className={buttonClasses("secondary", "sm")}>
                Buscar empresas
              </Link>
            }
          />
        </Panel>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3 text-xs text-ink-muted">
            <span>
              <span className="tabular-nums">{result.points.length}</span> de{" "}
              <span className="tabular-nums">{result.total}</span> leads no mapa
            </span>
            {result.withoutCoordinates > 0 ? (
              <span className="text-ink-subtle">
                {result.withoutCoordinates} sem coordenadas
              </span>
            ) : null}
            {result.total > MAX_POINTS ? (
              <span className="text-ink-subtle">
                mostrando os {MAX_POINTS} de maior score - filtre para refinar
              </span>
            ) : null}
            <span className="ml-auto flex items-center gap-2">
              <Badge tone="positive">Score alto</Badge>
              <Badge tone="warning">Médio</Badge>
              <Badge>Baixo</Badge>
            </span>
          </div>

          <LeadsMap points={result.points} />
        </div>
      )}
    </>
  );
}
