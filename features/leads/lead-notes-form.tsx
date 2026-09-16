"use client";

/** Anotações livres sobre o lead (CRM básico). */

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { initialLeadActionState, saveLeadNotesAction } from "@/server/actions/lead-actions";

export function LeadNotesForm({ leadId, notes }: { leadId: string; notes: string | null }) {
  const [state, formAction, pending] = useActionState(saveLeadNotesAction, initialLeadActionState);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="leadId" value={leadId} />
      <label htmlFor="lead-notes" className="sr-only">
        Anotações sobre o lead
      </label>
      <Textarea
        id="lead-notes"
        name="notes"
        rows={4}
        maxLength={5000}
        defaultValue={notes ?? ""}
        placeholder="Quem atendeu, o que foi combinado, próximo passo..."
      />
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Salvando..." : "Salvar anotações"}
        </Button>
        {state.message ? (
          <p
            role="status"
            className={state.status === "error" ? "text-xs text-negative" : "text-xs text-positive"}
          >
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
