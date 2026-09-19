import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader, Panel } from "@/components/ui/feedback";
import { DeadlineBadge, EnumBadge } from "@/components/ui/indicators";
import { CLIENT_STATUS, PROJECT_STATUS, TASK_STATUS } from "@/lib/domain/enums";
import { formatMoney } from "@/lib/money";
import { optionalParam } from "@/lib/search-params";
import { requireUser } from "@/server/auth/dal";
import { searchEverything } from "@/server/repositories/global-search";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Busca" };

export default async function SearchPage({ searchParams }: PageProps<"/busca">) {
  await requireUser();

  const term = optionalParam(await searchParams, "q");

  if (!term || term.length < 2) {
    return (
      <>
        <PageHeader title="Busca" description="Clientes, projetos e tarefas em uma consulta só." />
        <Panel>
          <EmptyState
            title="Digite o que procura"
            description="Use a barra no topo. Funciona com nome, empresa, e-mail, telefone e WhatsApp."
          />
        </Panel>
      </>
    );
  }

  const results = await searchEverything(term);

  return (
    <>
      <PageHeader
        title={`Resultados para "${term}"`}
        description={`${results.total} resultado(s) em clientes, projetos e tarefas.`}
      />

      {results.total === 0 ? (
        <Panel>
          <EmptyState
            title="Nada encontrado"
            description="Tente outro termo, ou parte do nome. Telefones podem ser buscados só pelos números."
          />
        </Panel>
      ) : null}

      {results.clients.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-medium tracking-wide text-ink-subtle uppercase">Clientes</h2>
          <Panel className="px-4">
            <ul className="flex flex-col divide-y divide-line">
              {results.clients.map((client) => (
                <li key={client.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                  <Link
                    href={`/clientes/${client.id}`}
                    className="min-w-0 flex-1 truncate text-sm font-medium text-ink hover:text-accent hover:underline"
                  >
                    {client.name}
                    {client.company ? (
                      <span className="font-normal text-ink-subtle"> · {client.company}</span>
                    ) : null}
                  </Link>
                  <span className="text-xs text-ink-subtle">
                    {client.whatsapp ?? client.phone ?? client.email ?? ""}
                  </span>
                  <EnumBadge option={CLIENT_STATUS[client.status]} />
                </li>
              ))}
            </ul>
          </Panel>
        </section>
      ) : null}

      {results.projects.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-medium tracking-wide text-ink-subtle uppercase">Projetos</h2>
          <Panel className="px-4">
            <ul className="flex flex-col divide-y divide-line">
              {results.projects.map((project) => (
                <li key={project.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                  <Link
                    href={`/projetos/${project.id}`}
                    className="min-w-0 flex-1 truncate text-sm font-medium text-ink hover:text-accent hover:underline"
                  >
                    {project.name}
                    <span className="font-normal text-ink-subtle"> · {project.client.name}</span>
                  </Link>
                  <span className="text-xs text-ink-muted tabular-nums">
                    {formatMoney(project.valueCents)}
                  </span>
                  <EnumBadge option={PROJECT_STATUS[project.status]} />
                  <DeadlineBadge deadline={project.deadline} />
                </li>
              ))}
            </ul>
          </Panel>
        </section>
      ) : null}

      {results.tasks.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-medium tracking-wide text-ink-subtle uppercase">Tarefas</h2>
          <Panel className="px-4">
            <ul className="flex flex-col divide-y divide-line">
              {results.tasks.map((task) => (
                <li key={task.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                  <Link
                    href={`/projetos/${task.project.id}?aba=tarefas`}
                    className="min-w-0 flex-1 truncate text-sm text-ink hover:text-accent hover:underline"
                  >
                    {task.title}
                    <span className="text-ink-subtle"> · {task.project.name}</span>
                  </Link>
                  <EnumBadge option={TASK_STATUS[task.status]} />
                  {task.status === "DONE" ? null : <DeadlineBadge deadline={task.deadline} />}
                </li>
              ))}
            </ul>
          </Panel>
        </section>
      ) : null}
    </>
  );
}
