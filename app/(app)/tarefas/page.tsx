import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState, PageHeader, Panel } from "@/components/ui/feedback";
import { DeadlineBadge, EnumBadge } from "@/components/ui/indicators";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { formatDate } from "@/lib/dates";
import { PRIORITY, TASK_STATUS } from "@/lib/domain/enums";
import { taskFiltersSchema } from "@/lib/schemas/work";
import { TaskFilters } from "@/features/tasks/task-filters";
import { NewTaskButton, TaskBoard } from "@/features/tasks/task-board";
import { requireUser } from "@/server/auth/dal";
import { listProjectOptions } from "@/server/repositories/project-repository";
import { listTasks } from "@/server/repositories/task-repository";
import { listActiveUsers } from "@/server/repositories/user-repository";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Tarefas" };

export default async function TasksPage({ searchParams }: PageProps<"/tarefas">) {
  const user = await requireUser();

  const filters = taskFiltersSchema.parse(await searchParams);
  const [tasks, projects, users] = await Promise.all([
    listTasks(filters, user.id),
    listProjectOptions(),
    listActiveUsers(),
  ]);

  const hasFilters = Boolean(
    filters.q ||
      filters.status ||
      filters.priority ||
      filters.projectId ||
      filters.assignedUserId ||
      filters.scope === "minhas",
  );

  return (
    <>
      <PageHeader
        title="Tarefas"
        description="O trabalho de todos os projetos em um quadro só."
        actions={
          projects.length > 0 ? <NewTaskButton projects={projects} users={users} /> : null
        }
      />

      <TaskFilters filters={filters} projects={projects} users={users} />

      {tasks.length === 0 ? (
        <Panel>
          <EmptyState
            title={hasFilters ? "Nenhuma tarefa com esses filtros" : "Nenhuma tarefa cadastrada"}
            description={
              hasFilters
                ? "Ajuste os filtros para ver outras tarefas."
                : projects.length === 0
                  ? "Tarefas pertencem a um projeto. Crie um projeto para começar."
                  : "Quebre o projeto em tarefas para acompanhar o andamento no quadro."
            }
            action={
              hasFilters ? (
                <Link href="/tarefas" className={buttonClasses("secondary", "sm")}>
                  Limpar filtros
                </Link>
              ) : projects.length === 0 ? (
                <Link href="/projetos/novo" className={buttonClasses("primary", "sm")}>
                  Criar projeto
                </Link>
              ) : null
            }
          />
        </Panel>
      ) : filters.view === "lista" ? (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Tarefa</Th>
                <Th>Projeto</Th>
                <Th>Responsável</Th>
                <Th>Prioridade</Th>
                <Th>Situação</Th>
                <Th>Prazo</Th>
                <Th>Criada em</Th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <Tr key={task.id}>
                  <Td>
                    <Link
                      href={`/projetos/${task.project.id}?aba=tarefas`}
                      className="font-medium text-ink hover:text-accent hover:underline"
                    >
                      {task.title}
                    </Link>
                  </Td>
                  <Td>
                    <span className="text-xs text-ink-muted">{task.project.name}</span>
                  </Td>
                  <Td>
                    <span className="text-xs text-ink-muted">
                      {task.assignee?.name ?? "Sem responsável"}
                    </span>
                  </Td>
                  <Td>
                    <EnumBadge option={PRIORITY[task.priority]} />
                  </Td>
                  <Td>
                    <EnumBadge option={TASK_STATUS[task.status]} />
                  </Td>
                  <Td>
                    {task.status === "DONE" ? (
                      <span className="text-xs text-ink-subtle">Concluída</span>
                    ) : (
                      <DeadlineBadge deadline={task.deadline} />
                    )}
                  </Td>
                  <Td>
                    <span className="text-xs text-ink-muted">{formatDate(task.createdAt)}</span>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      ) : (
        <TaskBoard tasks={tasks} projects={projects} users={users} />
      )}
    </>
  );
}
