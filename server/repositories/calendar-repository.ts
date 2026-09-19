/**
 * O calendário junta quatro origens diferentes em uma lista só de dias:
 * prazos de projeto, prazos de tarefa, vencimentos de parcela e os
 * compromissos criados à mão.
 *
 * Nenhuma delas é copiada para uma tabela de eventos. Se fossem, mudar o prazo
 * do projeto exigiria lembrar de atualizar o calendário - e um dia não seria
 * lembrado. Aqui o calendário lê a origem e sempre mostra a verdade.
 */

import { prisma } from "@/server/db/prisma";
import { ACTIVE_PROJECT_STATUSES, type EventTypeValue } from "@/lib/domain/enums";

export type CalendarItemKind = "project" | "task" | "payment" | "event";

export interface CalendarItem {
  kind: CalendarItemKind;
  id: string;
  title: string;
  /** Linha de apoio: cliente, projeto ou valor. */
  subtitle: string;
  date: Date;
  href: string;
  /** Só para compromissos criados à mão. */
  eventType?: EventTypeValue;
  /** Item já resolvido (tarefa concluída, parcela paga) aparece apagado. */
  isDone?: boolean;
}

export async function listCalendarItems(from: Date, to: Date): Promise<CalendarItem[]> {
  const [projects, tasks, payments, events] = await Promise.all([
    prisma.project.findMany({
      where: { deadline: { gte: from, lte: to }, status: { not: "CANCELLED" } },
      select: {
        id: true,
        name: true,
        deadline: true,
        status: true,
        client: { select: { name: true } },
      },
    }),
    prisma.task.findMany({
      where: { deadline: { gte: from, lte: to } },
      select: {
        id: true,
        title: true,
        deadline: true,
        status: true,
        project: { select: { id: true, name: true } },
      },
    }),
    prisma.payment.findMany({
      where: { dueDate: { gte: from, lte: to }, status: { not: "CANCELLED" } },
      select: {
        id: true,
        amountCents: true,
        dueDate: true,
        status: true,
        project: { select: { id: true, name: true, client: { select: { name: true } } } },
      },
    }),
    prisma.calendarEvent.findMany({
      where: { startsAt: { gte: from, lte: to } },
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        startsAt: true,
        project: { select: { id: true, name: true } },
        client: { select: { id: true, name: true } },
      },
    }),
  ]);

  const items: CalendarItem[] = [
    ...projects.map((project) => ({
      kind: "project" as const,
      id: project.id,
      title: `Entrega: ${project.name}`,
      subtitle: project.client.name,
      date: project.deadline as Date,
      href: `/projetos/${project.id}`,
      isDone: !ACTIVE_PROJECT_STATUSES.includes(project.status),
    })),
    ...tasks.map((task) => ({
      kind: "task" as const,
      id: task.id,
      title: task.title,
      subtitle: task.project.name,
      date: task.deadline as Date,
      href: `/projetos/${task.project.id}?aba=tarefas`,
      isDone: task.status === "DONE",
    })),
    ...payments.map((payment) => ({
      kind: "payment" as const,
      id: payment.id,
      title: `Pagamento: ${(payment.amountCents / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      })}`,
      subtitle: `${payment.project.name} · ${payment.project.client.name}`,
      date: payment.dueDate as Date,
      href: `/projetos/${payment.project.id}?aba=financeiro`,
      isDone: payment.status === "PAID",
    })),
    ...events.map((event) => ({
      kind: "event" as const,
      id: event.id,
      title: event.title,
      subtitle: event.project?.name ?? event.client?.name ?? event.description ?? "",
      date: event.startsAt,
      href: event.project
        ? `/projetos/${event.project.id}`
        : event.client
          ? `/clientes/${event.client.id}`
          : "/calendario",
      eventType: event.type,
    })),
  ];

  return items.sort((a, b) => a.date.getTime() - b.date.getTime());
}
