"use client";

/**
 * Controles rápidos da visão geral do projeto: progresso e situação do
 * contrato. São coisas que se mexem com frequência e não justificam abrir o
 * formulário completo de edição.
 */

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { FormFeedback } from "@/components/ui/form-feedback";
import { ProgressBar } from "@/components/ui/progress";
import { CONTRACT_STATUS_OPTIONS, type ContractStatusValue } from "@/lib/domain/enums";
import { initialActionState } from "@/server/actions/action-state";
import { updateContractAction, updateProgressAction } from "@/server/actions/project-actions";

/** Atalhos de 0 a 100 mais um campo livre, como pedido. */
const PROGRESS_STEPS = [0, 25, 50, 75, 100] as const;

export function ProgressControl({
  projectId,
  progress,
}: {
  projectId: string;
  progress: number;
}) {
  const [state, formAction, pending] = useActionState(updateProgressAction, initialActionState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="projectId" value={projectId} />

      <ProgressBar value={progress} label="Progresso" />

      <div className="flex flex-wrap items-end gap-2">
        {/* Os atalhos enviam o formulário direto: um clique, um valor. */}
        <div className="flex flex-wrap gap-1">
          {PROGRESS_STEPS.map((step) => (
            <button
              key={step}
              type="submit"
              name="progress"
              value={step}
              disabled={pending}
              className="rounded-md border border-line px-2 py-1 text-xs text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink disabled:opacity-50"
            >
              {step}%
            </button>
          ))}
        </div>

        <label className="flex items-center gap-1.5 text-xs text-ink-muted">
          <span className="sr-only">Progresso personalizado</span>
          <input
            type="number"
            name="progress"
            min={0}
            max={100}
            step={1}
            defaultValue={progress}
            className="h-8 w-20 rounded-md border border-line bg-surface px-2 text-sm text-ink focus:border-accent focus:outline-none"
          />
          %
        </label>

        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Salvando..." : "Definir"}
        </Button>
      </div>

      <FormFeedback state={state} />
    </form>
  );
}

export function ContractControl({
  projectId,
  contractStatus,
}: {
  projectId: string;
  contractStatus: ContractStatusValue;
}) {
  const [state, formAction, pending] = useActionState(updateContractAction, initialActionState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="projectId" value={projectId} />

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink-muted">Situação do contrato</span>
        <Select name="contractStatus" defaultValue={contractStatus} className="w-44">
          {CONTRACT_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </label>

      <Button type="submit" size="md" disabled={pending}>
        {pending ? "Salvando..." : "Atualizar"}
      </Button>

      <FormFeedback state={state} className="basis-full" />
    </form>
  );
}
