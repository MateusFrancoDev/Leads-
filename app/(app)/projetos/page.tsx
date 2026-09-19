import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState, PageHeader, Panel } from "@/components/ui/feedback";
import { DeadlineBadge, EnumBadge } from "@/components/ui/indicators";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { PRIORITY, PROJECT_STATUS, PROJECT_TYPE } from "@/lib/domain/enums";
import { formatMoney } from "@/lib/money";
import { projectFiltersSchema } from "@/lib/schemas/crm";
import { ProjectBoard } from "@/features/projects/project-board";
import { ProjectCard } from "@/features/projects/project-card";
import { ProjectFilters } from "@/features/projects/project-filters";
import { requireUser } from "@/server/auth/dal";
import { listClientOptions } from "@/server/repositories/client-repository";
import { listProjects } from "@/server/repositories/project-repository";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Projetos" };

export default async function ProjectsPage({ searchParams }: PageProps<"/projetos">) {
  await requireUser();

  const filters = projectFiltersSchema.parse(await searchParams);
  const [projects, clients] = await Promise.all([listProjects(filters), listClientOptions()]);

  const hasFilters = Boolean(
    filters.q || filters.status || filters.type || filters.priority || filters.clientId || filters.overdue,
  );

  return (
    <>
      <PageHeader
        title="Projetos"
        description="Tudo que foi vendido, em que etapa está e quanto já entrou."
        actions={
          clients.length > 0 ? (
            <Link href="/projetos/novo" className={buttonClasses("primary", "sm")}>
              <Plus className="size-3.5" aria-hidden />
              Novo projeto
            </Link>
          ) : null
        }
      />

      <ProjectFilters filters={filters} clients={clients} />

      {projects.length === 0 ? (
        <Panel>
          <EmptyState
            title={hasFilters ? "Nenhum projeto com esses filtros" : "Nenhum projeto cadastrado ainda"}
            description={
              hasFilters
                ? "Ajuste os filtros para ver outros projetos."
                : clients.length === 0
                  ? "Projetos pertencem a um cliente. Cadastre o primeiro cliente para começar."
                  : "Registre o primeiro projeto para acompanhar prazo, progresso e pagamentos."
            }
            action={
              hasFilters ? (
                <Link href="/projetos" className={buttonClasses("secondary", "sm")}>
                  Limpar filtros
                </Link>
              ) : clients.length === 0 ? (
                <Link href="/clientes/novo" className={buttonClasses("primary", "sm")}>
                  Cadastrar primeiro cliente
                </Link>
              ) : (
                <Link href="/projetos/novo" className={buttonClasses("primary", "sm")}>
                  Criar primeiro projeto
                </Link>
              )
            }
          />
        </Panel>
      ) : filters.view === "kanban" ? (
        <ProjectBoard projects={projects} />
      ) : filters.view === "tabela" ? (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Projeto</Th>
                <Th>Cliente</Th>
                <Th>Tipo</Th>
                <Th>Status</Th>
                <Th>Prioridade</Th>
                <Th>Prazo</Th>
                <Th align="right">Valor</Th>
                <Th align="right">Recebido</Th>
                <Th align="right">Progresso</Th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <Tr key={project.id}>
                  <Td>
                    <Link
                      href={`/projetos/${project.id}`}
                      className="font-medium text-ink hover:text-accent hover:underline"
                    >
                      {project.name}
                    </Link>
                  </Td>
                  <Td>
                    <Link
                      href={`/clientes/${project.client.id}`}
                      className="text-xs text-ink-muted hover:underline"
                    >
                      {project.client.company ?? project.client.name}
                    </Link>
                  </Td>
                  <Td>
                    <span className="text-xs text-ink-muted">{PROJECT_TYPE[project.type].label}</span>
                  </Td>
                  <Td>
                    <EnumBadge option={PROJECT_STATUS[project.status]} />
                  </Td>
                  <Td>
                    <EnumBadge option={PRIORITY[project.priority]} />
                  </Td>
                  <Td>
                    <DeadlineBadge deadline={project.deadline} startDate={project.startDate} />
                  </Td>
                  <Td align="right">{formatMoney(project.valueCents)}</Td>
                  <Td align="right">
                    <span className={project.finance.receivedCents > 0 ? "text-positive" : undefined}>
                      {formatMoney(project.finance.receivedCents)}
                    </span>
                  </Td>
                  <Td align="right">
                    <span className="tabular-nums">{project.progress}%</span>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      {projects.length > 0 && filters.view !== "kanban" ? (
        <div className="flex flex-wrap items-baseline justify-between gap-3 text-xs text-ink-subtle">
          <span>
            {projects.length} projeto{projects.length === 1 ? "" : "s"}.
          </span>
          <span className="tabular-nums">
            Total: {formatMoney(projects.reduce((sum, project) => sum + project.valueCents, 0))} ·
            Recebido:{" "}
            {formatMoney(projects.reduce((sum, project) => sum + project.finance.receivedCents, 0))}
          </span>
        </div>
      ) : null}
    </>
  );
}
