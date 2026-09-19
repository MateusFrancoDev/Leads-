"use client";

/**
 * Formulários de dinheiro: lançar parcela a receber e registrar custo.
 * Ficam no mesmo arquivo porque são quase o mesmo formulário e sempre
 * aparecem lado a lado na aba Financeiro do projeto.
 */

import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { FormFeedback } from "@/components/ui/form-feedback";
import { useFormAction } from "@/components/ui/use-form-action";
import { EXPENSE_CATEGORY_OPTIONS, PAYMENT_METHOD_OPTIONS } from "@/lib/domain/enums";
import { toDateInputValue } from "@/lib/dates";
import { centsToInput } from "@/lib/money";
import type { ActionState } from "@/server/actions/action-state";
import type { ProjectOption } from "@/features/tasks/task-form";

export interface PaymentFormValues {
  id?: string;
  projectId?: string;
  description?: string | null;
  amountCents?: number;
  method?: string;
  dueDate?: Date | null;
  paidAt?: Date | null;
}

export function PaymentForm({
  action,
  projects,
  values = {},
  lockedProjectId,
  /** Sugestão de valor: o que ainda falta parcelar no projeto. */
  suggestedCents,
  submitLabel = "Lançar parcela",
  onDone,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  projects: ReadonlyArray<ProjectOption>;
  values?: PaymentFormValues;
  lockedProjectId?: string;
  suggestedCents?: number;
  submitLabel?: string;
  onDone?: () => void;
}) {
  const [state, formAction, pending] = useFormAction(action, { onSuccess: () => onDone?.() });
  const errors = state.fieldErrors ?? {};

  const defaultAmount =
    values.amountCents !== undefined
      ? centsToInput(values.amountCents)
      : suggestedCents && suggestedCents > 0
        ? centsToInput(suggestedCents)
        : "";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {values.id ? <input type="hidden" name="paymentId" value={values.id} /> : null}
      {lockedProjectId ? <input type="hidden" name="projectId" value={lockedProjectId} /> : null}

      {lockedProjectId ? null : (
        <Field label="Projeto *" htmlFor="payment-project" error={errors.projectId}>
          <Select id="payment-project" name="projectId" required defaultValue={values.projectId ?? ""}>
            <option value="" disabled>
              Escolha o projeto
            </option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name} — {project.client.name}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Valor *" htmlFor="payment-amount" error={errors.amountCents}>
          <Input
            id="payment-amount"
            name="amountCents"
            inputMode="decimal"
            required
            defaultValue={defaultAmount}
            placeholder="1000,00"
          />
        </Field>

        <Field label="Forma de pagamento" htmlFor="payment-method" error={errors.method}>
          <Select id="payment-method" name="method" defaultValue={values.method ?? "PIX"}>
            {PAYMENT_METHOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Vencimento" htmlFor="payment-due" error={errors.dueDate}>
          <Input
            id="payment-due"
            name="dueDate"
            type="date"
            defaultValue={toDateInputValue(values.dueDate)}
          />
        </Field>

        <Field
          label="Recebido em"
          htmlFor="payment-paid"
          hint="Preencher marca a parcela como recebida."
          error={errors.paidAt}
        >
          <Input
            id="payment-paid"
            name="paidAt"
            type="date"
            defaultValue={toDateInputValue(values.paidAt)}
          />
        </Field>
      </div>

      <Field label="Descrição" htmlFor="payment-description" error={errors.description}>
        <Input
          id="payment-description"
          name="description"
          maxLength={200}
          defaultValue={values.description ?? ""}
          placeholder="Entrada, 2ª parcela..."
        />
      </Field>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FormFeedback state={state} />
        <Button type="submit" variant="primary" disabled={pending} className="ml-auto">
          {pending ? "Salvando..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

export function ExpenseForm({
  action,
  projects,
  lockedProjectId,
  submitLabel = "Registrar custo",
  onDone,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  projects: ReadonlyArray<ProjectOption>;
  lockedProjectId?: string;
  submitLabel?: string;
  onDone?: () => void;
}) {
  const [state, formAction, pending] = useFormAction(action, { onSuccess: () => onDone?.() });
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {lockedProjectId ? <input type="hidden" name="projectId" value={lockedProjectId} /> : null}

      {lockedProjectId ? null : (
        <Field label="Projeto *" htmlFor="expense-project" error={errors.projectId}>
          <Select id="expense-project" name="projectId" required defaultValue="">
            <option value="" disabled>
              Escolha o projeto
            </option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name} — {project.client.name}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <Field label="Descrição *" htmlFor="expense-description" error={errors.description}>
        <Input
          id="expense-description"
          name="description"
          required
          maxLength={200}
          placeholder="Hospedagem anual"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Categoria" htmlFor="expense-category" error={errors.category}>
          <Select id="expense-category" name="category" defaultValue="OTHER">
            {EXPENSE_CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Valor *" htmlFor="expense-amount" error={errors.amountCents}>
          <Input
            id="expense-amount"
            name="amountCents"
            inputMode="decimal"
            required
            placeholder="240,00"
          />
        </Field>

        <Field label="Data" htmlFor="expense-date" error={errors.date}>
          <Input
            id="expense-date"
            name="date"
            type="date"
            defaultValue={toDateInputValue(new Date())}
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FormFeedback state={state} />
        <Button type="submit" variant="primary" disabled={pending} className="ml-auto">
          {pending ? "Salvando..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
