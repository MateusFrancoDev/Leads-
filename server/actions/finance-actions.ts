"use server";

/** Escrita de pagamentos e despesas. */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createLogger } from "@/lib/logger";
import { formatMoney } from "@/lib/money";
import { EXPENSE_CATEGORY } from "@/lib/domain/enums";
import { expenseSchema, paymentSchema } from "@/lib/schemas/work";
import { id } from "@/lib/schemas/fields";
import {
  failure,
  formValues,
  invalidInput,
  success,
  type ActionState,
} from "@/server/actions/action-state";
import { requireUser } from "@/server/auth/dal";
import {
  createExpense,
  createPayment,
  deleteExpense,
  deletePayment,
  findExpense,
  findPayment,
  setPaymentPaid,
  updatePayment,
} from "@/server/repositories/finance-repository";
import { logActivity } from "@/server/services/activity-log";

const logger = createLogger("finance-action");

function revalidateFinancePages(projectId: string, clientId?: string): void {
  revalidatePath("/financeiro");
  revalidatePath("/dashboard");
  revalidatePath("/hoje");
  revalidatePath("/calendario");
  revalidatePath(`/projetos/${projectId}`);
  if (clientId) revalidatePath(`/clientes/${clientId}`);
}

export async function createPaymentAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = paymentSchema.safeParse(formValues(formData));
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const payment = await createPayment(parsed.data);
    const wasPaid = payment.status === "PAID";

    await logActivity({
      userId: user.id,
      projectId: payment.projectId,
      entityType: "PAYMENT",
      entityId: payment.id,
      action: wasPaid ? "PAYMENT_RECEIVED" : "PAYMENT_REGISTERED",
      description: wasPaid
        ? `${user.name} registrou o recebimento de ${formatMoney(payment.amountCents)}.`
        : `${user.name} lançou uma parcela de ${formatMoney(payment.amountCents)} a receber.`,
    });

    revalidateFinancePages(payment.projectId);
    return success(wasPaid ? "Pagamento registrado." : "Parcela lançada.");
  } catch (error) {
    logger.error("falha ao registrar pagamento");
    return failure(error);
  }
}

export async function updatePaymentAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = paymentSchema.safeParse(formValues(formData));
  if (!parsed.success) return invalidInput(parsed.error);

  const paymentId = z.string().min(1).safeParse(formData.get("paymentId"));
  if (!paymentId.success) return { status: "error", message: "Parcela inválida." };

  try {
    const payment = await updatePayment(paymentId.data, parsed.data);

    await logActivity({
      userId: user.id,
      projectId: payment.projectId,
      entityType: "PAYMENT",
      entityId: payment.id,
      action: "UPDATED",
      description: `${user.name} atualizou a parcela de ${formatMoney(payment.amountCents)}.`,
    });

    revalidateFinancePages(payment.projectId);
    return success("Parcela atualizada.");
  } catch (error) {
    logger.error("falha ao atualizar pagamento");
    return failure(error);
  }
}

/** Marcar como recebido / desfazer. Um clique, sem abrir formulário. */
export async function togglePaymentPaidAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = z
    .object({ paymentId: id, paid: z.enum(["true", "false"]) })
    .safeParse(formValues(formData));
  if (!parsed.success) return invalidInput(parsed.error);

  const paid = parsed.data.paid === "true";

  try {
    const payment = await setPaymentPaid(parsed.data.paymentId, paid);

    await logActivity({
      userId: user.id,
      projectId: payment.projectId,
      entityType: "PAYMENT",
      entityId: payment.id,
      action: paid ? "PAYMENT_RECEIVED" : "UPDATED",
      description: paid
        ? `${user.name} registrou pagamento de ${formatMoney(payment.amountCents)}.`
        : `${user.name} desfez o recebimento de ${formatMoney(payment.amountCents)}.`,
    });

    revalidateFinancePages(payment.projectId, payment.project.client.id);
    return success(paid ? "Pagamento registrado." : "Parcela voltou para pendente.");
  } catch (error) {
    logger.error("falha ao alternar pagamento");
    return failure(error);
  }
}

export async function deletePaymentAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = z.object({ paymentId: id }).safeParse(formValues(formData));
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const payment = await findPayment(parsed.data.paymentId);
    if (!payment) return { status: "error", message: "Parcela não encontrada." };

    await deletePayment(payment.id);

    await logActivity({
      userId: user.id,
      projectId: payment.projectId,
      entityType: "PAYMENT",
      entityId: payment.id,
      action: "DELETED",
      description: `${user.name} excluiu a parcela de ${formatMoney(payment.amountCents)}.`,
    });

    revalidateFinancePages(payment.projectId, payment.project.client.id);
    return success("Parcela excluída.");
  } catch (error) {
    logger.error("falha ao excluir pagamento");
    return failure(error);
  }
}

export async function createExpenseAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = expenseSchema.safeParse(formValues(formData));
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const expense = await createExpense(parsed.data);

    await logActivity({
      userId: user.id,
      projectId: expense.projectId,
      entityType: "EXPENSE",
      entityId: expense.id,
      action: "EXPENSE_REGISTERED",
      description: `${user.name} registrou um custo de ${formatMoney(expense.amountCents)} (${EXPENSE_CATEGORY[expense.category].label}).`,
    });

    revalidateFinancePages(expense.projectId);
    return success("Custo registrado.");
  } catch (error) {
    logger.error("falha ao registrar custo");
    return failure(error);
  }
}

export async function deleteExpenseAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = z.object({ expenseId: id }).safeParse(formValues(formData));
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const expense = await findExpense(parsed.data.expenseId);
    if (!expense) return { status: "error", message: "Custo não encontrado." };

    await deleteExpense(expense.id);

    await logActivity({
      userId: user.id,
      projectId: expense.projectId,
      entityType: "EXPENSE",
      entityId: expense.id,
      action: "DELETED",
      description: `${user.name} excluiu o custo de ${formatMoney(expense.amountCents)}.`,
    });

    revalidateFinancePages(expense.projectId, expense.project.client.id);
    return success("Custo excluído.");
  } catch (error) {
    logger.error("falha ao excluir custo");
    return failure(error);
  }
}
