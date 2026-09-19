import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader, Panel } from "@/components/ui/feedback";
import { LeadsFiltersForm } from "@/features/leads/leads-filters-form";
import { LeadsResults } from "@/features/leads/leads-results";
import { parseLeadFilters } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Favoritos" };

export default async function FavoritesPage({ searchParams }: PageProps<"/leads/favoritos">) {
  // Favoritos e a mesma listagem com o filtro fixo - sem duplicar a tela.
  const filters = { ...parseLeadFilters(await searchParams), favorites: true };

  return (
    <>
      <PageHeader
        title="Favoritos"
        description="Leads que você marcou para acompanhar de perto."
      />

      <Panel className="p-4 md:p-5">
        <LeadsFiltersForm action="/leads/favoritos" filters={filters} />
      </Panel>

      <Suspense fallback={<p className="text-sm text-ink-muted">Carregando favoritos...</p>}>
        <LeadsResults
          filters={filters}
          basePath="/leads/favoritos"
          emptyTitle="Nenhum favorito ainda"
          emptyDescription="Abra um lead e use Favoritar para guardar as melhores oportunidades aqui."
        />
      </Suspense>
    </>
  );
}
