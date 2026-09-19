"use client";

/**
 * Altera o status do lead direto na tabela.
 *
 * Não usa <form> de propósito: a tabela inteira já vive dentro do formulário
 * de exportação, e formulários aninhados são HTML inválido. A ação e chamada
 * diretamente com um FormData montado na mao - mesma Server Action validada
 * que a página de detalhes usa, sem duplicar regra.
 */

import { startTransition, useActionState } from "react";
import { updateLeadStatusAction } from "@/server/actions/lead-actions";
import { LEAD_STATUS_LABELS, LEAD_STATUS_ORDER, type LeadStatus } from "@/types/lead";
import { initialLeadActionState } from "@/server/actions/leads-action-state";

export function LeadStatusCell({ leadId, status }: { leadId: string; status: LeadStatus }) {
  const [state, dispatch, pending] = useActionState(
    updateLeadStatusAction,
    initialLeadActionState,
  );

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const formData = new FormData();
    formData.set("leadId", leadId);
    formData.set("status", event.target.value);
    startTransition(() => dispatch(formData));
  }

  return (
    <div className="flex items-center gap-1.5">
      <label className="sr-only" htmlFor={`status-${leadId}`}>
        Status do lead
      </label>
      <select
        id={`status-${leadId}`}
        defaultValue={status}
        onChange={handleChange}
        disabled={pending}
        className="h-7 rounded-md border border-line bg-surface px-1.5 text-xs text-ink focus:border-accent focus:outline-none disabled:opacity-60"
      >
        {LEAD_STATUS_ORDER.map((option) => (
          <option key={option} value={option}>
            {LEAD_STATUS_LABELS[option]}
          </option>
        ))}
      </select>
      {state.status === "error" ? (
        <span role="status" className="text-xs text-negative">
          erro
        </span>
      ) : null}
    </div>
  );
}
