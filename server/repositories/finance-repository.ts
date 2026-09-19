/**
 * Pagamentos (o que entra) e despesas (o que sai).
 *
 * "Atrasado" não é um valor gravado: é PENDING com vencimento no passado.
 * Por isso o filtro por atraso vira uma condição de data, e não um status -
 * assim nenhum job precisa rodar de madrugada para manter a tabela correta.
 */

import { prisma } from "@/server/db/prisma";
import { startOfDay, endOfMonth, startOfMonth } from "@/lib/dates";
import type { ExpenseCategoryValue, PaymentMethodValue, PaymentStatusValue } from "@/lib/domain/enums";
import type { ExpenseInput, FinanceFilters, PaymentInput } from "@/lib/schemas/work";

export interface PaymentRow {
  id: string;
  description: string | null;
  amountCents: number;
  method: PaymentMethodValue;
  status: PaymentStatusValue;
  dueDate: Date | null;
  paidAt: Date | null;
  createdAt: Date;
  project: { id: string; name: string; client: { id: string; name: string } };
}

export interface ExpenseRow {
  id: string;
  description: string;
  category: ExpenseCategoryValue;
  amountCents: number;
  date: Date;
  project: { id: string; name: string; client: { id: string; name: string } };
}

const PROJECT_REF = {
  select: { id: true, name: true, client: { select: { id: true, name: true } } },
} as const;

/** Intervalo de um mês no formato "2026-09", ou null para todo o período. */
function monthRange(month: string | undefined): { gte: Date; lte: Date } | undefined {
  if (!month) return undefined;
  const [year, monthNumber] = month.split("-").map(Number);
  const start = startOfMonth(new Date(year, monthNumber - 1, 1));
  return { gte: start, lte: endOfMonth(start) };
}

export async function listPayments(filters: FinanceFilters): Promise<PaymentRow[]> {
  const range = monthRange(filters.month);
  const today = startOfDay(new Date());

  return prisma.payment.findMany({
    where: {
      projectId: filters.projectId,
      method: filters.method,
      ...(filters.clientId ? { project: { clientId: filters.clientId } } : {}),
      ...(filters.status === "OVERDUE"
        ? { status: "PENDING", dueDate: { lt: today } }
        : filters.status
          ? { status: filters.status }
          : {}),
      // O mês filtra pela data que importa: pago olha o recebimento, o resto olha o vencimento.
      ...(range
        ? filters.status === "PAID"
          ? { paidAt: range }
          : { OR: [{ dueDate: range }, { AND: [{ dueDate: null }, { createdAt: range }] }] }
        : {}),
    },
    select: {
      id: true,
      description: true,
      amountCents: true,
      method: true,
      status: true,
      dueDate: true,
      paidAt: true,
      createdAt: true,
      project: PROJECT_REF,
    },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
  });
}

export async function listExpenses(filters: FinanceFilters): Promise<ExpenseRow[]> {
  const range = monthRange(filters.month);

  return prisma.expense.findMany({
    where: {
      projectId: filters.projectId,
      ...(filters.clientId ? { project: { clientId: filters.clientId } } : {}),
      ...(range ? { date: range } : {}),
    },
    select: {
      id: true,
      description: true,
      category: true,
      amountCents: true,
      date: true,
      project: PROJECT_REF,
    },
    orderBy: { date: "desc" },
  });
}

/** Parcelas em aberto que vencem até a data indicada. Alimenta "Hoje" e o painel. */
export async function listPaymentsDueUntil(until: Date): Promise<PaymentRow[]> {
  return prisma.payment.findMany({
    where: { status: "PENDING", dueDate: { not: null, lte: until } },
    select: {
      id: true,
      description: true,
      amountCents: true,
      method: true,
      status: true,
      dueDate: true,
      paidAt: true,
      createdAt: true,
      project: PROJECT_REF,
    },
    orderBy: { dueDate: "asc" },
  });
}

export async function createPayment(data: PaymentInput) {
  return prisma.payment.create({
    data: { ...data, status: data.paidAt ? "PAID" : "PENDING" },
  });
}

export async function updatePayment(id: string, data: PaymentInput) {
  return prisma.payment.update({
    where: { id },
    data: { ...data, status: data.paidAt ? "PAID" : "PENDING" },
  });
}

/** Marca a parcela como recebida hoje (ou desfaz, voltando para pendente). */
export async function setPaymentPaid(id: string, paid: boolean) {
  return prisma.payment.update({
    where: { id },
    data: paid ? { status: "PAID", paidAt: new Date() } : { status: "PENDING", paidAt: null },
    include: { project: PROJECT_REF },
  });
}

export async function findPayment(id: string) {
  return prisma.payment.findUnique({ where: { id }, include: { project: PROJECT_REF } });
}

export async function deletePayment(id: string): Promise<void> {
  await prisma.payment.delete({ where: { id } });
}

export async function createExpense(data: ExpenseInput) {
  return prisma.expense.create({ data: { ...data, date: data.date ?? new Date() } });
}

export async function findExpense(id: string) {
  return prisma.expense.findUnique({ where: { id }, include: { project: PROJECT_REF } });
}

export async function deleteExpense(id: string): Promise<void> {
  await prisma.expense.delete({ where: { id } });
}
