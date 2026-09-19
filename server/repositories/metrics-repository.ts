/**
 * Números do painel e dos relatórios.
 *
 * As séries por mês são montadas em memória a partir dos registros do período,
 * e não por SQL com date_trunc. O motivo é o tamanho real do problema: uma
 * empresa de dois sócios gera algumas centenas de pagamentos por ano, e manter
 * tudo em Prisma Client evita SQL cru difícil de revisar. Se um dia o volume
 * crescer, o lugar de mudar é só este arquivo.
 */

import { prisma } from "@/server/db/prisma";
import {
  addDays,
  addMonths,
  formatMonthLabel,
  lastMonths,
  startOfDay,
  startOfMonth,
} from "@/lib/dates";
import { ACTIVE_PROJECT_STATUSES, type ProjectTypeValue } from "@/lib/domain/enums";
import { profitMargin } from "@/lib/money";

/** Cartões do topo do painel. */
export interface DashboardTotals {
  clients: number;
  activeClients: number;
  activeProjects: number;
  completedProjects: number;
  overdueProjects: number;
  /** Soma do valor combinado de todos os projetos não cancelados. */
  soldCents: number;
  receivedCents: number;
  receivableCents: number;
  costCents: number;
  profitCents: number;
  marginPercent: number | null;
  pendingTasks: number;
  overduePaymentsCount: number;
  overduePaymentsCents: number;
}

export async function readDashboardTotals(now: Date = new Date()): Promise<DashboardTotals> {
  const today = startOfDay(now);

  const [
    clients,
    activeClients,
    activeProjects,
    completedProjects,
    overdueProjects,
    soldAggregate,
    receivedAggregate,
    costAggregate,
    pendingTasks,
    overduePayments,
    pendingPayments,
  ] = await Promise.all([
    prisma.client.count(),
    prisma.client.count({ where: { status: "ACTIVE" } }),
    prisma.project.count({ where: { status: { in: [...ACTIVE_PROJECT_STATUSES] } } }),
    prisma.project.count({ where: { status: "COMPLETED" } }),
    prisma.project.count({
      where: { status: { in: [...ACTIVE_PROJECT_STATUSES] }, deadline: { lt: today } },
    }),
    prisma.project.aggregate({
      where: { status: { not: "CANCELLED" } },
      _sum: { valueCents: true },
    }),
    prisma.payment.aggregate({ where: { status: "PAID" }, _sum: { amountCents: true } }),
    prisma.expense.aggregate({ _sum: { amountCents: true } }),
    prisma.task.count({ where: { status: { not: "DONE" } } }),
    prisma.payment.aggregate({
      where: { status: "PENDING", dueDate: { lt: today } },
      _sum: { amountCents: true },
      _count: true,
    }),
    prisma.payment.aggregate({ where: { status: "PENDING" }, _sum: { amountCents: true } }),
  ]);

  const soldCents = soldAggregate._sum.valueCents ?? 0;
  const receivedCents = receivedAggregate._sum.amountCents ?? 0;
  const costCents = costAggregate._sum.amountCents ?? 0;

  return {
    clients,
    activeClients,
    activeProjects,
    completedProjects,
    overdueProjects,
    soldCents,
    receivedCents,
    // O que falta entrar: parcelas em aberto. Se ainda não há parcelas
    // cadastradas, cai no combinado menos o recebido.
    receivableCents: pendingPayments._sum.amountCents ?? Math.max(0, soldCents - receivedCents),
    costCents,
    profitCents: soldCents - costCents,
    marginPercent: profitMargin(soldCents, costCents),
    pendingTasks,
    overduePaymentsCount: overduePayments._count,
    overduePaymentsCents: overduePayments._sum.amountCents ?? 0,
  };
}

/** Um ponto das séries mensais. */
export interface MonthlyPoint {
  /** "set/26" */
  label: string;
  month: Date;
  revenueCents: number;
  costCents: number;
  profitCents: number;
  closedProjects: number;
}

export async function readMonthlySeries(
  months: number,
  now: Date = new Date(),
): Promise<MonthlyPoint[]> {
  const series = lastMonths(months, now);
  const from = series[0];
  const to = addMonths(startOfMonth(now), 1);

  const [payments, expenses, closed] = await Promise.all([
    prisma.payment.findMany({
      where: { status: "PAID", paidAt: { gte: from, lt: to } },
      select: { amountCents: true, paidAt: true },
    }),
    prisma.expense.findMany({
      where: { date: { gte: from, lt: to } },
      select: { amountCents: true, date: true },
    }),
    prisma.project.findMany({
      where: { status: "COMPLETED", completedAt: { gte: from, lt: to } },
      select: { completedAt: true },
    }),
  ]);

  // Chave "2026-8" (ano + índice do mês) para juntar tudo no balde certo.
  const key = (date: Date) => `${date.getFullYear()}-${date.getMonth()}`;
  const points = new Map<string, MonthlyPoint>(
    series.map((month) => [
      key(month),
      {
        label: formatMonthLabel(month),
        month,
        revenueCents: 0,
        costCents: 0,
        profitCents: 0,
        closedProjects: 0,
      },
    ]),
  );

  for (const payment of payments) {
    if (!payment.paidAt) continue;
    const point = points.get(key(payment.paidAt));
    if (point) point.revenueCents += payment.amountCents;
  }
  for (const expense of expenses) {
    const point = points.get(key(expense.date));
    if (point) point.costCents += expense.amountCents;
  }
  for (const project of closed) {
    if (!project.completedAt) continue;
    const point = points.get(key(project.completedAt));
    if (point) point.closedProjects += 1;
  }

  const result = [...points.values()];
  for (const point of result) point.profitCents = point.revenueCents - point.costCents;
  return result;
}

/** Quantos projetos por tipo de serviço, do mais vendido para o menos. */
export async function readProjectsByType(): Promise<
  Array<{ type: ProjectTypeValue; count: number; valueCents: number }>
> {
  const groups = await prisma.project.groupBy({
    by: ["type"],
    where: { status: { not: "CANCELLED" } },
    _count: true,
    _sum: { valueCents: true },
  });

  return groups
    .map((group) => ({
      type: group.type as ProjectTypeValue,
      count: group._count,
      valueCents: group._sum.valueCents ?? 0,
    }))
    .sort((a, b) => b.count - a.count);
}

/** Prazo que se aproxima: projeto ou tarefa, já ordenado pela data. */
export interface UpcomingDeadline {
  kind: "project" | "task";
  id: string;
  title: string;
  subtitle: string;
  deadline: Date;
  href: string;
}

export async function readUpcomingDeadlines(
  days: number,
  now: Date = new Date(),
): Promise<UpcomingDeadline[]> {
  const today = startOfDay(now);
  const limit = addDays(today, days);

  const [projects, tasks] = await Promise.all([
    prisma.project.findMany({
      where: {
        status: { in: [...ACTIVE_PROJECT_STATUSES] },
        deadline: { gte: today, lte: limit },
      },
      select: { id: true, name: true, deadline: true, client: { select: { name: true } } },
      orderBy: { deadline: "asc" },
    }),
    prisma.task.findMany({
      where: { status: { not: "DONE" }, deadline: { gte: today, lte: limit } },
      select: { id: true, title: true, deadline: true, project: { select: { id: true, name: true } } },
      orderBy: { deadline: "asc" },
    }),
  ]);

  const items: UpcomingDeadline[] = [
    ...projects.map((project) => ({
      kind: "project" as const,
      id: project.id,
      title: project.name,
      subtitle: project.client.name,
      deadline: project.deadline as Date,
      href: `/projetos/${project.id}`,
    })),
    ...tasks.map((task) => ({
      kind: "task" as const,
      id: task.id,
      title: task.title,
      subtitle: task.project.name,
      deadline: task.deadline as Date,
      href: `/projetos/${task.project.id}?aba=tarefas`,
    })),
  ];

  return items.sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
}

/** Respostas do tipo "qual cliente mais gerou receita". */
export interface Ranking {
  topClientsByRevenue: Array<{ id: string; name: string; valueCents: number }>;
  topClientsByProjects: Array<{ id: string; name: string; count: number }>;
  topProjectsByProfit: Array<{ id: string; name: string; client: string; profitCents: number }>;
}

export async function readRankings(limit = 5): Promise<Ranking> {
  const projects = await prisma.project.findMany({
    where: { status: { not: "CANCELLED" } },
    select: {
      id: true,
      name: true,
      valueCents: true,
      client: { select: { id: true, name: true } },
      expenses: { select: { amountCents: true } },
    },
  });

  const byClient = new Map<string, { id: string; name: string; valueCents: number; count: number }>();
  const byProfit: Ranking["topProjectsByProfit"] = [];

  for (const project of projects) {
    const entry = byClient.get(project.client.id) ?? {
      id: project.client.id,
      name: project.client.name,
      valueCents: 0,
      count: 0,
    };
    entry.valueCents += project.valueCents;
    entry.count += 1;
    byClient.set(project.client.id, entry);

    const costCents = project.expenses.reduce((sum, expense) => sum + expense.amountCents, 0);
    byProfit.push({
      id: project.id,
      name: project.name,
      client: project.client.name,
      profitCents: project.valueCents - costCents,
    });
  }

  const clients = [...byClient.values()];

  return {
    topClientsByRevenue: [...clients]
      .sort((a, b) => b.valueCents - a.valueCents)
      .slice(0, limit)
      .map(({ id, name, valueCents }) => ({ id, name, valueCents })),
    topClientsByProjects: [...clients]
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
      .map(({ id, name, count }) => ({ id, name, count })),
    topProjectsByProfit: byProfit.sort((a, b) => b.profitCents - a.profitCents).slice(0, limit),
  };
}

/** Totais do mês corrente, para responder "quanto vendemos este mês?". */
export async function readCurrentMonthTotals(now: Date = new Date()) {
  const from = startOfMonth(now);
  const to = addMonths(from, 1);

  const [sold, received, cost] = await Promise.all([
    prisma.project.aggregate({
      where: { status: { not: "CANCELLED" }, createdAt: { gte: from, lt: to } },
      _sum: { valueCents: true },
      _count: true,
    }),
    prisma.payment.aggregate({
      where: { status: "PAID", paidAt: { gte: from, lt: to } },
      _sum: { amountCents: true },
    }),
    prisma.expense.aggregate({
      where: { date: { gte: from, lt: to } },
      _sum: { amountCents: true },
    }),
  ]);

  const soldCents = sold._sum.valueCents ?? 0;
  const costCents = cost._sum.amountCents ?? 0;

  return {
    soldCents,
    newProjects: sold._count,
    receivedCents: received._sum.amountCents ?? 0,
    costCents,
    profitCents: soldCents - costCents,
  };
}
