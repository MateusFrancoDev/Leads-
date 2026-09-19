/**
 * Acesso à tabela de tarefas.
 *
 * A ordem dentro da coluna do Kanban é guardada em `position`. Ao soltar um
 * cartão gravamos a posição da tarefa movida e reenumeramos a coluna inteira,
 * o que mantém os números compactos sem precisar de fracionário.
 */

import { prisma } from "@/server/db/prisma";
import type { PriorityValue, TaskStatusValue } from "@/lib/domain/enums";
import type { TaskFilters, TaskInput } from "@/lib/schemas/work";
import { addDays, startOfDay } from "@/lib/dates";

export interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatusValue;
  priority: PriorityValue;
  deadline: Date | null;
  completedAt: Date | null;
  position: number;
  createdAt: Date;
  project: { id: string; name: string; client: { id: string; name: string } };
  assignee: { id: string; name: string; avatarUrl: string | null } | null;
}

const TASK_SELECT = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  deadline: true,
  completedAt: true,
  position: true,
  createdAt: true,
  project: { select: { id: true, name: true, client: { select: { id: true, name: true } } } },
  assignee: { select: { id: true, name: true, avatarUrl: true } },
} as const;

export async function listTasks(filters: TaskFilters, currentUserId: string): Promise<TaskRow[]> {
  return prisma.task.findMany({
    where: {
      status: filters.status,
      priority: filters.priority,
      projectId: filters.projectId,
      assignedUserId:
        filters.scope === "minhas" ? currentUserId : (filters.assignedUserId ?? undefined),
      ...(filters.q
        ? {
            OR: [
              { title: { contains: filters.q, mode: "insensitive" } },
              { description: { contains: filters.q, mode: "insensitive" } },
              { project: { name: { contains: filters.q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    select: TASK_SELECT,
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
}

/** Tarefas em aberto que vencem até a data indicada. Alimenta "Hoje". */
export async function listTasksDueUntil(until: Date, assignedUserId?: string): Promise<TaskRow[]> {
  return prisma.task.findMany({
    where: {
      status: { not: "DONE" },
      deadline: { not: null, lte: until },
      ...(assignedUserId ? { assignedUserId } : {}),
    },
    select: TASK_SELECT,
    orderBy: [{ deadline: "asc" }, { priority: "desc" }],
  });
}

export async function findTask(id: string) {
  return prisma.task.findUnique({
    where: { id },
    select: { ...TASK_SELECT, projectId: true, assignedUserId: true },
  });
}

export async function createTask(data: TaskInput, createdById: string) {
  // Entra no fim da coluna escolhida.
  const last = await prisma.task.findFirst({
    where: { projectId: data.projectId, status: data.status },
    select: { position: true },
    orderBy: { position: "desc" },
  });

  return prisma.task.create({
    data: {
      ...data,
      assignedUserId: data.assignedUserId ?? null,
      createdById,
      position: (last?.position ?? -1) + 1,
      ...(data.status === "DONE" ? { completedAt: new Date() } : {}),
    },
    select: { ...TASK_SELECT, projectId: true },
  });
}

export async function updateTask(id: string, data: TaskInput, wasDone: boolean) {
  const isDone = data.status === "DONE";
  return prisma.task.update({
    where: { id },
    data: {
      ...data,
      assignedUserId: data.assignedUserId ?? null,
      ...(isDone && !wasDone ? { completedAt: new Date() } : {}),
      ...(!isDone && wasDone ? { completedAt: null } : {}),
    },
    select: { ...TASK_SELECT, projectId: true },
  });
}

/**
 * Move a tarefa para outra coluna (ou outra posição na mesma) e reenumera
 * as duas colunas afetadas, em uma transação.
 */
export async function moveTask(
  id: string,
  status: TaskStatusValue,
  position: number | undefined,
): Promise<{ projectId: string; title: string; previousStatus: TaskStatusValue } | null> {
  const task = await prisma.task.findUnique({
    where: { id },
    select: { id: true, projectId: true, title: true, status: true },
  });
  if (!task) return null;

  const isDone = status === "DONE";
  const wasDone = task.status === "DONE";

  await prisma.$transaction(async (tx) => {
    await tx.task.update({
      where: { id },
      data: {
        status,
        // Posição provisória alta: a reenumeração logo abaixo acerta o valor.
        position: position ?? 9_999,
        ...(isDone && !wasDone ? { completedAt: new Date() } : {}),
        ...(!isDone && wasDone ? { completedAt: null } : {}),
      },
    });

    for (const column of new Set([task.status, status])) {
      const items = await tx.task.findMany({
        where: { projectId: task.projectId, status: column },
        select: { id: true },
        orderBy: [{ position: "asc" }, { updatedAt: "desc" }],
      });
      await Promise.all(
        items.map((item, index) =>
          tx.task.update({ where: { id: item.id }, data: { position: index } }),
        ),
      );
    }
  });

  return { projectId: task.projectId, title: task.title, previousStatus: task.status };
}

export async function deleteTask(id: string): Promise<void> {
  await prisma.task.delete({ where: { id } });
}

export async function countPendingTasks(assignedUserId?: string): Promise<number> {
  return prisma.task.count({
    where: { status: { not: "DONE" }, ...(assignedUserId ? { assignedUserId } : {}) },
  });
}

/** Tarefas que vencem hoje, para o cartão da página "Hoje". */
export async function countTasksDueToday(now: Date = new Date()): Promise<number> {
  const today = startOfDay(now);
  return prisma.task.count({
    where: { status: { not: "DONE" }, deadline: { gte: today, lt: addDays(today, 1) } },
  });
}
