"use client";

/** Cadastro e edição de tarefa. */

import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { FormFeedback } from "@/components/ui/form-feedback";
import { useFormAction } from "@/components/ui/use-form-action";
import { PRIORITY_OPTIONS, TASK_STATUS_OPTIONS } from "@/lib/domain/enums";
import { toDateInputValue } from "@/lib/dates";
import type { ActionState } from "@/server/actions/action-state";

export interface ProjectOption {
  id: string;
  name: string;
  client: { name: string };
}

export interface UserOption {
  id: string;
  name: string;
}

export interface TaskFormValues {
  id?: string;
  projectId?: string;
  title?: string;
  description?: string | null;
  assignedUserId?: string | null;
  priority?: string;
  status?: string;
  deadline?: Date | null;
}

export function TaskForm({
  action,
  projects,
  users,
  values = {},
  /** Quando a tarefa já nasce dentro de um projeto, o campo vira só leitura. */
  lockedProjectId,
  submitLabel = "Salvar tarefa",
  onDone,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  projects: ReadonlyArray<ProjectOption>;
  users: ReadonlyArray<UserOption>;
  values?: TaskFormValues;
  lockedProjectId?: string;
  submitLabel?: string;
  onDone?: () => void;
}) {
  const [state, formAction, pending] = useFormAction(action, { onSuccess: () => onDone?.() });
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {values.id ? <input type="hidden" name="taskId" value={values.id} /> : null}
      {lockedProjectId ? <input type="hidden" name="projectId" value={lockedProjectId} /> : null}

      <Field label="Título *" htmlFor="task-title" error={errors.title}>
        <Input
          id="task-title"
          name="title"
          required
          maxLength={200}
          defaultValue={values.title ?? ""}
          placeholder="Montar a página de contato"
        />
      </Field>

      {lockedProjectId ? null : (
        <Field label="Projeto *" htmlFor="task-project" error={errors.projectId}>
          <Select
            id="task-project"
            name="projectId"
            required
            defaultValue={values.projectId ?? ""}
          >
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

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Responsável" htmlFor="task-assignee" error={errors.assignedUserId}>
          <Select
            id="task-assignee"
            name="assignedUserId"
            defaultValue={values.assignedUserId ?? ""}
          >
            <option value="">Sem responsável</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Prioridade" htmlFor="task-priority" error={errors.priority}>
          <Select id="task-priority" name="priority" defaultValue={values.priority ?? "NORMAL"}>
            {PRIORITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Prazo" htmlFor="task-deadline" error={errors.deadline}>
          <Input
            id="task-deadline"
            name="deadline"
            type="date"
            defaultValue={toDateInputValue(values.deadline)}
          />
        </Field>
      </div>

      <Field label="Situação" htmlFor="task-status" error={errors.status}>
        <Select id="task-status" name="status" defaultValue={values.status ?? "TODO"}>
          {TASK_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Descrição" htmlFor="task-description" error={errors.description}>
        <Textarea
          id="task-description"
          name="description"
          maxLength={4000}
          defaultValue={values.description ?? ""}
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
