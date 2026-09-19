/**
 * Acesso à tabela de projetos.
 *
 * As consultas trazem os pagamentos e as despesas junto porque quase toda tela
 * de projeto mostra dinheiro: fazer isso em uma consulta evita o problema de
 * uma requisição por linha da lista.
 */

import { prisma } from "@/server/db/prisma";
import { ACTIVE_PROJECT_STATUSES } from "@/lib/domain/enums";
import type {
  ContractStatusValue,
  PriorityValue,
  ProjectStatusValue,
  ProjectTypeValue,
} from "@/lib/domain/enums";
import { summarizeProjectFinance, type ProjectFinance } from "@/lib/finance";
import { addDays, startOfDay } from "@/lib/dates";
import type { ProjectFilters, ProjectInput } from "@/lib/schemas/crm";

/** Projeto pronto para a lista: já com cliente, financeiro e contagem de tarefas. */
export interface ProjectRow {
  id: string;
  name: string;
  type: ProjectTypeValue;
  status: ProjectStatusValue;
  priority: PriorityValue;
  progress: number;
  valueCents: number;
  startDate: Date | null;
  deadline: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  client: { id: string; name: string; company: string | null };
  finance: ProjectFinance;
  openTaskCount: number;
}

const ROW_SELECT = {
  id: true,
  name: true,
  type: true,
  status: true,
  priority: true,
  progress: true,
  valueCents: true,
  startDate: true,
  deadline: true,
  completedAt: true,
  createdAt: true,
  client: { select: { id: true, name: true, company: true } },
  payments: { select: { amountCents: true, status: true, dueDate: true, paidAt: true } },
  expenses: { select: { amountCents: true } },
  _count: { select: { tasks: { where: { status: { not: "DONE" } } } } },
} as const;

type RawProject = {
  payments: Array<{ amountCents: number; status: "PENDING" | "PAID" | "CANCELLED"; dueDate: Date | null; paidAt: Date | null }>;
  expenses: Array<{ amountCents: number }>;
  _count: { tasks: number };
  valueCents: number;
} & Record<string, unknown>;

function toRow(project: RawProject, now: Date): ProjectRow {
  const { payments, expenses, _count, ...rest } = project;
  return {
    ...(rest as unknown as Omit<ProjectRow, "finance" | "openTaskCount">),
    finance: summarizeProjectFinance(project.valueCents, payments, expenses, now),
    openTaskCount: _count.tasks,
  };
}

export async function listProjects(filters: ProjectFilters): Promise<ProjectRow[]> {
  const now = new Date();

  // "Vence em N dias" e "atrasado" são filtros de prazo sobre projetos abertos.
  const deadlineFilter = filters.overdue
    ? { lt: startOfDay(now) }
    : filters.dueInDays
      ? { gte: startOfDay(now), lte: addDays(startOfDay(now), filters.dueInDays) }
      : undefined;

  const projects = await prisma.project.findMany({
    where: {
      clientId: filters.clientId,
      status: filters.status ?? (deadlineFilter ? { in: [...ACTIVE_PROJECT_STATUSES] } : undefined),
      type: filters.type,
      priority: filters.priority,
      ...(deadlineFilter ? { deadline: deadlineFilter } : {}),
      ...(filters.q
        ? {
            OR: [
              { name: { contains: filters.q, mode: "insensitive" } },
              { description: { contains: filters.q, mode: "insensitive" } },
              { client: { name: { contains: filters.q, mode: "insensitive" } } },
              { client: { company: { contains: filters.q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    select: ROW_SELECT,
    orderBy:
      filters.sort === "name"
        ? { name: "asc" }
        : filters.sort === "value"
          ? { valueCents: "desc" }
          : filters.sort === "recent"
            ? { createdAt: "desc" }
            // Por prazo: quem não tem data vai para o fim da fila.
            : [{ deadline: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
  });

  return projects.map((project) => toRow(project as RawProject, now));
}

/** Projetos de um cliente, para a página dele. */
export async function listProjectsByClient(clientId: string): Promise<ProjectRow[]> {
  return listProjects({ clientId, view: "cards", sort: "recent" } as ProjectFilters);
}

/** Projeto completo, com tudo que as abas da página precisam. */
export async function findProjectDetail(id: string) {
  return prisma.project.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true, company: true, email: true, phone: true, whatsapp: true } },
      briefing: true,
      payments: { orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }] },
      expenses: { orderBy: { date: "desc" } },
      tasks: {
        orderBy: [{ status: "asc" }, { position: "asc" }, { createdAt: "asc" }],
        include: {
          assignee: { select: { id: true, name: true, avatarUrl: true } },
          // O quadro de tarefas é o mesmo componente da tela /tarefas, e lá o
          // cartão mostra de que projeto a tarefa é - por isso vem junto.
          project: { select: { id: true, name: true, client: { select: { id: true, name: true } } } },
        },
      },
      projectNotes: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      },
      files: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, name: true } } },
      },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      },
    },
  });
}

export type ProjectDetail = NonNullable<Awaited<ReturnType<typeof findProjectDetail>>>;

/** Nome e cliente apenas - para selects e para montar frases do histórico. */
export async function findProjectSummary(id: string) {
  return prisma.project.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      status: true,
      progress: true,
      deadline: true,
      valueCents: true,
      clientId: true,
      client: { select: { id: true, name: true } },
    },
  });
}

export async function listProjectOptions(): Promise<
  Array<{ id: string; name: string; client: { name: string } }>
> {
  return prisma.project.findMany({
    where: { status: { notIn: ["CANCELLED"] } },
    select: { id: true, name: true, client: { select: { name: true } } },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });
}

export async function createProject(data: ProjectInput) {
  const { technologies, ...rest } = data;
  return prisma.project.create({
    data: {
      ...rest,
      technologies,
      // Concluir na criação já marca a data e crava 100%.
      ...(data.status === "COMPLETED" ? { completedAt: new Date(), progress: 100 } : {}),
    },
  });
}

export async function updateProject(id: string, data: ProjectInput, wasCompleted: boolean) {
  const isCompleted = data.status === "COMPLETED";
  return prisma.project.update({
    where: { id },
    data: {
      ...data,
      progress: isCompleted ? 100 : data.progress,
      // A data de conclusão só é gravada na transição, e some se o projeto reabrir.
      ...(isCompleted && !wasCompleted ? { completedAt: new Date() } : {}),
      ...(!isCompleted && wasCompleted ? { completedAt: null } : {}),
    },
  });
}

/** Mudança de status isolada (Kanban). Mantém progresso e conclusão coerentes. */
export async function updateProjectStatus(id: string, status: ProjectStatusValue) {
  const current = await prisma.project.findUnique({
    where: { id },
    select: { status: true, progress: true },
  });
  if (!current) return null;

  const isCompleted = status === "COMPLETED";
  const wasCompleted = current.status === "COMPLETED";

  return prisma.project.update({
    where: { id },
    data: {
      status,
      ...(isCompleted ? { progress: 100, ...(wasCompleted ? {} : { completedAt: new Date() }) } : {}),
      ...(!isCompleted && wasCompleted ? { completedAt: null } : {}),
    },
  });
}

export async function updateProjectProgress(id: string, progress: number) {
  return prisma.project.update({ where: { id }, data: { progress } });
}

export async function updateContractStatus(id: string, contractStatus: ContractStatusValue) {
  return prisma.project.update({ where: { id }, data: { contractStatus } });
}

export async function deleteProject(id: string): Promise<void> {
  await prisma.project.delete({ where: { id } });
}

export async function upsertBriefing(
  projectId: string,
  data: Omit<import("@/lib/schemas/crm").BriefingInput, "projectId">,
) {
  return prisma.briefing.upsert({
    where: { projectId },
    update: data,
    create: { projectId, ...data },
  });
}
