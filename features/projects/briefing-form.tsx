"use client";

/**
 * Briefing do projeto. Nenhum campo é obrigatório: o briefing costuma ser
 * preenchido aos poucos, conforme o cliente responde.
 */

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { FormFeedback } from "@/components/ui/form-feedback";
import { initialActionState } from "@/server/actions/action-state";
import { saveBriefingAction } from "@/server/actions/project-actions";

export interface BriefingValues {
  objective?: string | null;
  audience?: string | null;
  references?: string | null;
  colors?: string | null;
  style?: string | null;
  features?: string | null;
  competitors?: string | null;
  notes?: string | null;
}

export function BriefingForm({
  projectId,
  values = {},
}: {
  projectId: string;
  values?: BriefingValues;
}) {
  const [state, formAction, pending] = useActionState(saveBriefingAction, initialActionState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="projectId" value={projectId} />

      <Field label="Objetivo do projeto" htmlFor="briefing-objective" error={errors.objective}>
        <Textarea
          id="briefing-objective"
          name="objective"
          maxLength={4000}
          defaultValue={values.objective ?? ""}
          placeholder="O que o cliente quer conseguir com isso."
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Público" htmlFor="briefing-audience" error={errors.audience}>
          <Textarea
            id="briefing-audience"
            name="audience"
            maxLength={2000}
            defaultValue={values.audience ?? ""}
            placeholder="Quem vai usar / comprar."
          />
        </Field>

        <Field label="Concorrentes" htmlFor="briefing-competitors" error={errors.competitors}>
          <Textarea
            id="briefing-competitors"
            name="competitors"
            maxLength={2000}
            defaultValue={values.competitors ?? ""}
          />
        </Field>

        <Field label="Referências" htmlFor="briefing-references" error={errors.references}>
          <Textarea
            id="briefing-references"
            name="references"
            maxLength={2000}
            defaultValue={values.references ?? ""}
            placeholder="Sites e materiais que o cliente gostou."
          />
        </Field>

        <Field label="Funcionalidades" htmlFor="briefing-features" error={errors.features}>
          <Textarea
            id="briefing-features"
            name="features"
            maxLength={4000}
            defaultValue={values.features ?? ""}
            placeholder="O que precisa existir: formulário, blog, checkout..."
          />
        </Field>

        <Field label="Cores" htmlFor="briefing-colors" error={errors.colors}>
          <Input
            id="briefing-colors"
            name="colors"
            maxLength={500}
            defaultValue={values.colors ?? ""}
            placeholder="Azul escuro e branco"
          />
        </Field>

        <Field label="Estilo desejado" htmlFor="briefing-style" error={errors.style}>
          <Input
            id="briefing-style"
            name="style"
            maxLength={1000}
            defaultValue={values.style ?? ""}
            placeholder="Sóbrio, moderno, sem exageros"
          />
        </Field>
      </div>

      <Field label="Observações" htmlFor="briefing-notes" error={errors.notes}>
        <Textarea
          id="briefing-notes"
          name="notes"
          maxLength={4000}
          defaultValue={values.notes ?? ""}
        />
      </Field>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FormFeedback state={state} />
        <Button type="submit" variant="primary" disabled={pending} className="ml-auto">
          {pending ? "Salvando..." : "Salvar briefing"}
        </Button>
      </div>
    </form>
  );
}
