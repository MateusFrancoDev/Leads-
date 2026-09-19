/**
 * Regras de dinheiro derivadas. Nada aqui é gravado no banco: "atrasado",
 * "quanto falta receber" e "lucro" são sempre calculados a partir dos
 * pagamentos e das despesas, para nunca existir um total desatualizado.
 *
 * Todos os valores em centavos (ver lib/money.ts).
 */

import { startOfDay } from "@/lib/dates";
import type { PaymentStatusValue } from "@/lib/domain/enums";
import { profitMargin } from "@/lib/money";

/** Pagamento no mínimo necessário para os cálculos desta camada. */
export interface PaymentLike {
  amountCents: number;
  status: PaymentStatusValue;
  dueDate: Date | null;
  paidAt: Date | null;
}

export interface ExpenseLike {
  amountCents: number;
}

/**
 * Situação real do pagamento: o banco só guarda PENDING/PAID/CANCELLED, e
 * "atrasado" nasce da comparação do vencimento com hoje.
 */
export type EffectivePaymentStatus = PaymentStatusValue | "OVERDUE";

export function effectivePaymentStatus(
  payment: PaymentLike,
  now: Date = new Date(),
): EffectivePaymentStatus {
  if (payment.status !== "PENDING") return payment.status;
  if (!payment.dueDate) return "PENDING";
  return startOfDay(payment.dueDate) < startOfDay(now) ? "OVERDUE" : "PENDING";
}

export function isOverdue(payment: PaymentLike, now: Date = new Date()): boolean {
  return effectivePaymentStatus(payment, now) === "OVERDUE";
}

/** Situação do projeto como um todo, exibida na aba Financeiro. */
export type ProjectPaymentStatus = "UNPAID" | "PARTIAL" | "PAID" | "OVERDUE";

export const PROJECT_PAYMENT_STATUS_LABEL: Record<ProjectPaymentStatus, string> = {
  UNPAID: "Não pago",
  PARTIAL: "Parcial",
  PAID: "Pago",
  OVERDUE: "Atrasado",
};

export interface ProjectFinance {
  /** Valor combinado com o cliente (Project.valueCents). */
  totalCents: number;
  /** Soma das parcelas já cadastradas (pode diferir do combinado). */
  scheduledCents: number;
  receivedCents: number;
  /** Combinado menos recebido: o que ainda entra. Nunca negativo. */
  remainingCents: number;
  overdueCents: number;
  costCents: number;
  profitCents: number;
  marginPercent: number | null;
  status: ProjectPaymentStatus;
}

export function summarizeProjectFinance(
  totalCents: number,
  payments: ReadonlyArray<PaymentLike>,
  expenses: ReadonlyArray<ExpenseLike>,
  now: Date = new Date(),
): ProjectFinance {
  let scheduledCents = 0;
  let receivedCents = 0;
  let overdueCents = 0;

  for (const payment of payments) {
    if (payment.status === "CANCELLED") continue;
    scheduledCents += payment.amountCents;
    if (payment.status === "PAID") receivedCents += payment.amountCents;
    else if (isOverdue(payment, now)) overdueCents += payment.amountCents;
  }

  const costCents = expenses.reduce((sum, expense) => sum + expense.amountCents, 0);
  const remainingCents = Math.max(0, totalCents - receivedCents);

  return {
    totalCents,
    scheduledCents,
    receivedCents,
    remainingCents,
    overdueCents,
    costCents,
    // O lucro considera o que foi de fato combinado, não o que já entrou:
    // é a rentabilidade do projeto, não o caixa.
    profitCents: totalCents - costCents,
    marginPercent: profitMargin(totalCents, costCents),
    status: projectPaymentStatus(totalCents, receivedCents, overdueCents),
  };
}

function projectPaymentStatus(
  totalCents: number,
  receivedCents: number,
  overdueCents: number,
): ProjectPaymentStatus {
  if (totalCents > 0 && receivedCents >= totalCents) return "PAID";
  if (overdueCents > 0) return "OVERDUE";
  return receivedCents > 0 ? "PARTIAL" : "UNPAID";
}

/** Quanto ainda falta parcelar: valor combinado menos as parcelas já criadas. */
export function unscheduledCents(totalCents: number, scheduledCents: number): number {
  return Math.max(0, totalCents - scheduledCents);
}
