"use client";

/** Criacao de lista de prospeccao (ex.: "Clinicas sem site - Osasco"). */

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { createListAction, initialListActionState } from "@/server/actions/list-actions";

export function CreateListForm() {
  const [state, formAction, pending] = useActionState(createListAction, initialListActionState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
        <Field label="Nome da lista" htmlFor="list-name" error={errors.name}>
          <Input
            id="list-name"
            name="name"
            required
            maxLength={80}
            placeholder="Clinicas sem site - Osasco"
          />
        </Field>
        <Field label="Descricao" htmlFor="list-description" error={errors.description}>
          <Input
            id="list-description"
            name="description"
            maxLength={240}
            placeholder="Opcional"
          />
        </Field>
        <Button type="submit" variant="primary" disabled={pending}>
          <Plus className="size-4" aria-hidden />
          {pending ? "Criando..." : "Criar lista"}
        </Button>
      </div>

      {state.message ? (
        <p
          role="status"
          className={state.status === "error" ? "text-xs text-negative" : "text-xs text-positive"}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
