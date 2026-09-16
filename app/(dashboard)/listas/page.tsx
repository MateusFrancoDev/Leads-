import type { Metadata } from "next";
import Link from "next/link";
import { ListChecks } from "lucide-react";
import { EmptyState, ErrorNotice, PageHeader, Panel } from "@/components/ui/feedback";
import { CreateListForm } from "@/features/lists/create-list-form";
import { userMessage } from "@/lib/errors";
import {
  listProspectingLists,
  type ProspectingListSummary,
} from "@/server/repositories/list-repository";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Listas" };

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

type LoadResult =
  | { ok: true; lists: ProspectingListSummary[] }
  | { ok: false; message: string };

async function loadLists(): Promise<LoadResult> {
  try {
    return { ok: true, lists: await listProspectingLists() };
  } catch (error) {
    return { ok: false, message: userMessage(error) };
  }
}

export default async function ListsPage() {
  const result = await loadLists();

  return (
    <>
      <PageHeader
        title="Listas de prospecção"
        description="Agrupe leads por campanha, região ou nicho para trabalhar em lote."
      />

      <Panel className="p-4 md:p-5">
        <CreateListForm />
      </Panel>

      {!result.ok ? (
        <ErrorNotice message={result.message} />
      ) : (
        <Panel className="overflow-hidden">
          {result.lists.length > 0 ? (
            <ul className="divide-y divide-line">
              {result.lists.map((list) => (
                <li key={list.id}>
                  <Link
                    href={`/listas/${list.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-muted"
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-medium text-ink">
                        <ListChecks className="size-4 text-ink-subtle" aria-hidden />
                        {list.name}
                      </p>
                      {list.description ? (
                        <p className="mt-0.5 truncate text-xs text-ink-muted">{list.description}</p>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm tabular-nums text-ink">{list.leadCount}</p>
                      <p className="text-xs text-ink-subtle">
                        {dateFormatter.format(list.updatedAt)}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="Nenhuma lista ainda"
              description="Crie uma lista acima e depois adicione leads a partir da página de cada empresa."
            />
          )}
        </Panel>
      )}
    </>
  );
}
