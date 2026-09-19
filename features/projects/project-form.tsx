"use client";

/** Cadastro e edição de projeto. Um só componente para os dois casos. */

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { FormFeedback } from "@/components/ui/form-feedback";
import { useFormAction } from "@/components/ui/use-form-action";
import {
  CONTRACT_STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  PROJECT_STATUS_OPTIONS,
  PROJECT_TYPE_OPTIONS,
} from "@/lib/domain/enums";
import { centsToInput } from "@/lib/money";
import { toDateInputValue } from "@/lib/dates";
import type { ActionState } from "@/server/actions/action-state";

export interface ProjectFormValues {
  id?: string;
  clientId?: string;
  name?: string;
  type?: string;
  description?: string | null;
  valueCents?: number;
  estimatedCostCents?: number;
  startDate?: Date | null;
  deadline?: Date | null;
  status?: string;
  priority?: string;
  progress?: number;
  technologies?: string[];
  projectUrl?: string | null;
  repositoryUrl?: string | null;
  notes?: string | null;
  contractStatus?: string;
}

export function ProjectForm({
  action,
  clients,
  values = {},
  submitLabel = "Salvar projeto",
  redirectOnSuccess,
  onDone,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  clients: ReadonlyArray<{ id: string; name: string; company: string | null }>;
  values?: ProjectFormValues;
  submitLabel?: string;
  redirectOnSuccess?: (projectId: string) => string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useFormAction(action, {
    onSuccess: (result) => {
      onDone?.();
      // Depois de criar, segue direto para a ficha do registro novo.
      if (redirectOnSuccess && result.createdId) router.push(redirectOnSuccess(result.createdId));
    },
  });
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {values.id ? <input type="hidden" name="projectId" value={values.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cliente *" htmlFor="project-client" error={errors.clientId}>
          <Select
            id="project-client"
            name="clientId"
            required
            defaultValue={values.clientId ?? ""}
          >
            <option value="" disabled>
              Escolha o cliente
            </option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.company ? `${client.name} — ${client.company}` : client.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Nome do projeto *" htmlFor="project-name" error={errors.name}>
          <Input
            id="project-name"
            name="name"
            required
            maxLength={160}
            defaultValue={values.name ?? ""}
            placeholder="Site institucional"
          />
        </Field>

        <Field label="Tipo de serviço" htmlFor="project-type" error={errors.type}>
          <Select id="project-type" name="type" defaultValue={values.type ?? "OTHER"}>
            {PROJECT_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Status" htmlFor="project-status" error={errors.status}>
          <Select id="project-status" name="status" defaultValue={values.status ?? "QUOTE"}>
            {PROJECT_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Valor cobrado"
          htmlFor="project-value"
          hint="Em reais. Ex.: 3000 ou 3.000,00"
          error={errors.valueCents}
        >
          <Input
            id="project-value"
            name="valueCents"
            inputMode="decimal"
            defaultValue={values.valueCents ? centsToInput(values.valueCents) : ""}
            placeholder="3000,00"
          />
        </Field>

        <Field
          label="Custo estimado"
          htmlFor="project-cost"
          hint="Previsão. O custo real vem dos lançamentos."
          error={errors.estimatedCostCents}
        >
          <Input
            id="project-cost"
            name="estimatedCostCents"
            inputMode="decimal"
            defaultValue={values.estimatedCostCents ? centsToInput(values.estimatedCostCents) : ""}
            placeholder="500,00"
          />
        </Field>

        <Field label="Data de início" htmlFor="project-start" error={errors.startDate}>
          <Input
            id="project-start"
            name="startDate"
            type="date"
            defaultValue={toDateInputValue(values.startDate)}
          />
        </Field>

        <Field label="Prazo de entrega" htmlFor="project-deadline" error={errors.deadline}>
          <Input
            id="project-deadline"
            name="deadline"
            type="date"
            defaultValue={toDateInputValue(values.deadline)}
          />
        </Field>

        <Field label="Prioridade" htmlFor="project-priority" error={errors.priority}>
          <Select id="project-priority" name="priority" defaultValue={values.priority ?? "NORMAL"}>
            {PRIORITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Progresso (%)"
          htmlFor="project-progress"
          hint="Concluir o projeto marca 100% sozinho."
          error={errors.progress}
        >
          <Input
            id="project-progress"
            name="progress"
            type="number"
            min={0}
            max={100}
            step={1}
            defaultValue={values.progress ?? 0}
          />
        </Field>

        <Field
          label="Tecnologias"
          htmlFor="project-technologies"
          hint="Separadas por vírgula."
          error={errors.technologies}
        >
          <Input
            id="project-technologies"
            name="technologies"
            defaultValue={(values.technologies ?? []).join(", ")}
            placeholder="Next.js, Prisma, Tailwind"
          />
        </Field>

        <Field label="Contrato" htmlFor="project-contract" error={errors.contractStatus}>
          <Select
            id="project-contract"
            name="contractStatus"
            defaultValue={values.contractStatus ?? "NOT_SENT"}
          >
            {CONTRACT_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Link do projeto" htmlFor="project-url" error={errors.projectUrl}>
          <Input
            id="project-url"
            name="projectUrl"
            maxLength={300}
            defaultValue={values.projectUrl ?? ""}
            placeholder="cliente.com.br"
          />
        </Field>

        <Field label="Repositório" htmlFor="project-repo" error={errors.repositoryUrl}>
          <Input
            id="project-repo"
            name="repositoryUrl"
            maxLength={300}
            defaultValue={values.repositoryUrl ?? ""}
            placeholder="github.com/usuario/projeto"
          />
        </Field>
      </div>

      <Field label="Descrição" htmlFor="project-description" error={errors.description}>
        <Textarea
          id="project-description"
          name="description"
          maxLength={4000}
          defaultValue={values.description ?? ""}
          placeholder="O que foi vendido, em uma ou duas frases."
        />
      </Field>

      <Field label="Observações" htmlFor="project-notes" error={errors.notes}>
        <Textarea
          id="project-notes"
          name="notes"
          maxLength={4000}
          defaultValue={values.notes ?? ""}
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
