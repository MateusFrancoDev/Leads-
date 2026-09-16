import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/feedback";
import { LeadsResults } from "@/features/leads/leads-results";
import { DeleteListButton } from "@/features/lists/delete-list-button";
import { parseLeadFilters } from "@/lib/validation";
import { findProspectingList } from "@/server/repositories/list-repository";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/listas/[id]">): Promise<Metadata> {
  const { id } = await params;
  const list = await findProspectingList(id);
  return { title: list?.name ?? "Lista" };
}

export default async function ListDetailPage({ params, searchParams }: PageProps<"/listas/[id]">) {
  const { id } = await params;
  const list = await findProspectingList(id);
  if (!list) notFound();

  // A listagem e a mesma de sempre, so que presa a esta lista.
  const filters = { ...parseLeadFilters(await searchParams), listId: id };

  return (
    <>
      <div>
        <Link
          href="/listas"
          className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Voltar para as listas
        </Link>
      </div>

      <PageHeader
        title={list.name}
        description={list.description ?? "Leads agrupados para trabalhar em lote."}
        actions={<DeleteListButton listId={list.id} listName={list.name} />}
      />

      <Suspense fallback={<p className="text-sm text-ink-muted">Carregando leads...</p>}>
        <LeadsResults
          filters={filters}
          basePath={`/listas/${id}`}
          emptyTitle="Lista vazia"
          emptyDescription="Abra um lead e use Adicionar a lista para inclui-lo aqui."
        />
      </Suspense>
    </>
  );
}
