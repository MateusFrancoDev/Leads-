import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader, Panel } from "@/components/ui/feedback";
import { LeadsFiltersForm } from "@/features/leads/leads-filters-form";
import { LeadsResults } from "@/features/leads/leads-results";
import { parseLeadFilters } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Todos os leads" };

export default async function LeadsPage({ searchParams }: PageProps<"/leads">) {
  const filters = parseLeadFilters(await searchParams);

  return (
    <>
      <PageHeader
        title="Todos os leads"
        description="Base completa já coletada. Filtrar aqui não consome nenhuma requisição de API."
      />

      <Panel className="p-4 md:p-5">
        <LeadsFiltersForm action="/leads" filters={filters} />
      </Panel>

      <Suspense fallback={<p className="text-sm text-ink-muted">Carregando leads...</p>}>
        <LeadsResults filters={filters} basePath="/leads" />
      </Suspense>
    </>
  );
}
