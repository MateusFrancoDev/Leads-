"use client";

/**
 * Aba Financeiro do projeto: parcelas a receber, custos e os totais que saem
 * da soma das duas coisas.
 *
 * Nada aqui é um total guardado no banco. "Recebido", "a receber" e "lucro"
 * são sempre recalculados a partir das linhas - é por isso que não existe
 * como o número ficar errado depois de editar uma parcela.
 */

import { useActionState, useState } from "react";
import { Check, Plus, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { EmptyState } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/modal";
import { Stat, StatGrid } from "@/components/ui/stat";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { formatDate } from "@/lib/dates";
import { EXPENSE_CATEGORY, PAYMENT_METHOD, type ExpenseCategoryValue, type PaymentMethodValue, type PaymentStatusValue } from "@/lib/domain/enums";
import {
  PROJECT_PAYMENT_STATUS_LABEL,
  effectivePaymentStatus,
  summarizeProjectFinance,
  unscheduledCents,
} from "@/lib/finance";
import { formatMoney, formatPercent } from "@/lib/money";
import { initialActionState } from "@/server/actions/action-state";
import {
  createExpenseAction,
  createPaymentAction,
  deleteExpenseAction,
  deletePaymentAction,
  togglePaymentPaidAction,
} from "@/server/actions/finance-actions";
import { ExpenseForm, PaymentForm } from "@/features/finance/finance-forms";

export interface PaymentItem {
  id: string;
  description: string | null;
  amountCents: number;
  method: PaymentMethodValue;
  status: PaymentStatusValue;
  dueDate: Date | null;
  paidAt: Date | null;
}

export interface ExpenseItem {
  id: string;
  description: string;
  category: ExpenseCategoryValue;
  amountCents: number;
  date: Date;
}

export function ProjectFinancePanel({
  projectId,
  valueCents,
  payments,
  expenses,
}: {
  projectId: string;
  valueCents: number;
  payments: ReadonlyArray<PaymentItem>;
  expenses: ReadonlyArray<ExpenseItem>;
}) {
  const [dialog, setDialog] = useState<"payment" | "expense" | null>(null);

  const finance = summarizeProjectFinance(valueCents, payments, expenses);
  const missing = unscheduledCents(valueCents, finance.scheduledCents);

  return (
    <div className="flex flex-col gap-5">
      <StatGrid columns={4}>
        <Stat label="Valor total" value={formatMoney(finance.totalCents)} />
        <Stat label="Recebido" value={formatMoney(finance.receivedCents)} tone="positive" />
        <Stat
          label="Falta receber"
          value={formatMoney(finance.remainingCents)}
          tone={finance.remainingCents > 0 ? "warning" : "default"}
        />
        <Stat
          label="Situação"
          value={PROJECT_PAYMENT_STATUS_LABEL[finance.status]}
          tone={
            finance.status === "PAID"
              ? "positive"
              : finance.status === "OVERDUE"
                ? "negative"
                : finance.status === "PARTIAL"
                  ? "warning"
                  : "default"
          }
        />
        <Stat label="Custos" value={formatMoney(finance.costCents)} />
        <Stat
          label="Lucro"
          value={formatMoney(finance.profitCents)}
          tone={finance.profitCents >= 0 ? "positive" : "negative"}
        />
        <Stat label="Margem" value={formatPercent(finance.marginPercent)} />
        <Stat
          label="Não parcelado"
          value={formatMoney(missing)}
          hint={missing > 0 ? "Falta lançar como parcela" : "Tudo parcelado"}
        />
      </StatGrid>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-ink">Parcelas</h3>
          <Button type="button" variant="primary" size="sm" onClick={() => setDialog("payment")}>
            <Plus className="size-3.5" aria-hidden />
            Lançar parcela
          </Button>
        </div>

        {payments.length === 0 ? (
          <EmptyState
            title="Nenhuma parcela lançada"
            description="Lance a entrada e as demais parcelas para acompanhar o que já entrou e o que ainda falta."
          />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Descrição</Th>
                  <Th>Forma</Th>
                  <Th>Vencimento</Th>
                  <Th>Recebido em</Th>
                  <Th>Situação</Th>
                  <Th align="right">Valor</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => {
                  const status = effectivePaymentStatus(payment);
                  return (
                    <Tr key={payment.id}>
                      <Td>{payment.description ?? "Parcela"}</Td>
                      <Td>
                        <span className="text-xs text-ink-muted">
                          {PAYMENT_METHOD[payment.method].label}
                        </span>
                      </Td>
                      <Td>
                        <span className="text-xs text-ink-muted">{formatDate(payment.dueDate)}</span>
                      </Td>
                      <Td>
                        <span className="text-xs text-ink-muted">{formatDate(payment.paidAt)}</span>
                      </Td>
                      <Td>
                        <Badge
                          tone={
                            status === "PAID"
                              ? "positive"
                              : status === "OVERDUE"
                                ? "negative"
                                : status === "CANCELLED"
                                  ? "neutral"
                                  : "warning"
                          }
                        >
                          {status === "PAID"
                            ? "Recebido"
                            : status === "OVERDUE"
                              ? "Atrasado"
                              : status === "CANCELLED"
                                ? "Cancelado"
                                : "A receber"}
                        </Badge>
                      </Td>
                      <Td align="right">{formatMoney(payment.amountCents)}</Td>
                      <Td>
                        <div className="flex items-center justify-end gap-1">
                          <TogglePaidButton
                            paymentId={payment.id}
                            isPaid={payment.status === "PAID"}
                          />
                          <ConfirmAction
                            action={deletePaymentAction}
                            hiddenFields={{ paymentId: payment.id }}
                            title="Excluir parcela"
                            description={`A parcela de ${formatMoney(payment.amountCents)} será removida.`}
                            triggerLabel="Excluir"
                          />
                        </div>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-ink">Custos</h3>
          <Button type="button" size="sm" onClick={() => setDialog("expense")}>
            <Plus className="size-3.5" aria-hidden />
            Registrar custo
          </Button>
        </div>

        {expenses.length === 0 ? (
          <EmptyState
            title="Nenhum custo registrado"
            description="Domínio, hospedagem, freelancer, licença: o que sai daqui entra no cálculo do lucro."
          />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Descrição</Th>
                  <Th>Categoria</Th>
                  <Th>Data</Th>
                  <Th align="right">Valor</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <Tr key={expense.id}>
                    <Td>{expense.description}</Td>
                    <Td>
                      <span className="text-xs text-ink-muted">
                        {EXPENSE_CATEGORY[expense.category].label}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-xs text-ink-muted">{formatDate(expense.date)}</span>
                    </Td>
                    <Td align="right">{formatMoney(expense.amountCents)}</Td>
                    <Td>
                      <div className="flex justify-end">
                        <ConfirmAction
                          action={deleteExpenseAction}
                          hiddenFields={{ expenseId: expense.id }}
                          title="Excluir custo"
                          description={`"${expense.description}" será removido do projeto.`}
                          triggerLabel="Excluir"
                        />
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </section>

      <Modal
        open={dialog === "payment"}
        onClose={() => setDialog(null)}
        title="Lançar parcela"
        description={
          missing > 0 ? `Falta parcelar ${formatMoney(missing)} deste projeto.` : undefined
        }
      >
        <PaymentForm
          action={createPaymentAction}
          projects={[]}
          lockedProjectId={projectId}
          suggestedCents={missing}
          onDone={() => setDialog(null)}
        />
      </Modal>

      <Modal open={dialog === "expense"} onClose={() => setDialog(null)} title="Registrar custo">
        <ExpenseForm
          action={createExpenseAction}
          projects={[]}
          lockedProjectId={projectId}
          onDone={() => setDialog(null)}
        />
      </Modal>
    </div>
  );
}

/** Marca a parcela como recebida (ou desfaz) em um clique. */
function TogglePaidButton({ paymentId, isPaid }: { paymentId: string; isPaid: boolean }) {
  const [, formAction, pending] = useActionState(togglePaymentPaidAction, initialActionState);

  return (
    <form action={formAction}>
      <input type="hidden" name="paymentId" value={paymentId} />
      <input type="hidden" name="paid" value={isPaid ? "false" : "true"} />
      <Button type="submit" size="sm" variant="ghost" disabled={pending}>
        {isPaid ? (
          <>
            <Undo2 className="size-3.5" aria-hidden />
            Desfazer
          </>
        ) : (
          <>
            <Check className="size-3.5" aria-hidden />
            Recebi
          </>
        )}
      </Button>
    </form>
  );
}
