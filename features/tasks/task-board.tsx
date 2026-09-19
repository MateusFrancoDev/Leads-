"use client";

/**
 * Kanban de tarefas: A fazer / Em andamento / Em revisão / Concluído.
 *
 * Mesmo mecanismo do quadro de projetos: arrastar nativo do HTML, com seletor
 * de coluna em cada cartão para o toque e para o teclado. A posição dentro da
 * coluna é enviada junto, então a ordem escolhida é preservada.
 */

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Avatar } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { DeadlineBadge, EnumBadge } from "@/components/ui/indicators";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/cn";
import { PRIORITY, TASK_STATUS, TASK_STATUSES, type TaskStatusValue } from "@/lib/domain/enums";
import { initialActionState } from "@/server/actions/action-state";
import {
  createTaskAction,
  deleteTaskAction,
  moveTaskAction,
  updateTaskAction,
} from "@/server/actions/task-actions";
import { TaskForm, type ProjectOption, type UserOption } from "@/features/tasks/task-form";
import type { TaskRow } from "@/server/repositories/task-repository";

export function TaskBoard({
  tasks,
  projects,
  users,
  /** Dentro de um projeto, o cartão não precisa repetir o nome do projeto. */
  hideProject = false,
}: {
  tasks: ReadonlyArray<TaskRow>;
  projects: ReadonlyArray<ProjectOption>;
  users: ReadonlyArray<UserOption>;
  hideProject?: boolean;
}) {
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<TaskStatusValue | null>(null);
  const [editing, setEditing] = useState<TaskRow | null>(null);

  const [optimistic, moveOptimistic] = useOptimistic(
    tasks,
    (current, move: { id: string; status: TaskStatusValue }) =>
      current.map((task) => (task.id === move.id ? { ...task, status: move.status } : task)),
  );

  function move(taskId: string, status: TaskStatusValue, position?: number): void {
    const task = optimistic.find((item) => item.id === taskId);
    if (!task || task.status === status) return;

    setError(null);
    startTransition(async () => {
      moveOptimistic({ id: taskId, status });

      const formData = new FormData();
      formData.set("taskId", taskId);
      formData.set("status", status);
      if (position !== undefined) formData.set("position", String(position));

      const result = await moveTaskAction(initialActionState, formData);
      if (result.status === "error") setError(result.message ?? "Não foi possível mover a tarefa.");
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      ) : null}

      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
        {TASK_STATUSES.map((status) => {
          const columnTasks = optimistic.filter((task) => task.status === status);

          return (
            <section
              key={status}
              onDragOver={(event) => {
                event.preventDefault();
                setDropTarget(status);
              }}
              onDragLeave={() => setDropTarget((current) => (current === status ? null : current))}
              onDrop={(event) => {
                event.preventDefault();
                setDropTarget(null);
                const taskId = event.dataTransfer.getData("text/plain");
                if (taskId) move(taskId, status, columnTasks.length);
              }}
              className={cn(
                "flex w-72 shrink-0 flex-col gap-2 rounded-lg border bg-canvas p-2 transition-colors",
                dropTarget === status ? "border-accent bg-accent-soft" : "border-line",
              )}
            >
              <header className="flex items-baseline justify-between gap-2 px-1.5 pt-1">
                <h3 className="text-xs font-medium text-ink">{TASK_STATUS[status].label}</h3>
                <span className="text-xs text-ink-subtle tabular-nums">{columnTasks.length}</span>
              </header>

              {columnTasks.length === 0 ? (
                <p className="px-1.5 py-6 text-center text-xs text-ink-subtle">
                  Nenhuma tarefa aqui.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {columnTasks.map((task) => (
                    <li
                      key={task.id}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/plain", task.id);
                        event.dataTransfer.effectAllowed = "move";
                      }}
                      className="cursor-grab rounded-lg border border-line bg-surface p-2.5 active:cursor-grabbing"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setEditing(task)}
                          className="min-w-0 flex-1 text-left text-sm text-ink hover:text-accent"
                        >
                          {task.title}
                        </button>
                        {task.assignee ? (
                          <Avatar
                            name={task.assignee.name}
                            avatarUrl={task.assignee.avatarUrl}
                            className="size-5 text-[9px]"
                          />
                        ) : null}
                      </div>

                      {hideProject ? null : (
                        <Link
                          href={`/projetos/${task.project.id}`}
                          className="mt-1 block truncate text-xs text-ink-subtle hover:underline"
                        >
                          {task.project.name}
                        </Link>
                      )}

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {task.priority !== "NORMAL" ? (
                          <EnumBadge option={PRIORITY[task.priority]} />
                        ) : null}
                        {task.deadline && task.status !== "DONE" ? (
                          <DeadlineBadge deadline={task.deadline} />
                        ) : null}
                      </div>

                      <label className="mt-2 flex items-center gap-1.5">
                        <span className="sr-only">Mover {task.title} para</span>
                        <select
                          value={task.status}
                          onChange={(event) =>
                            move(task.id, event.target.value as TaskStatusValue)
                          }
                          className="w-full rounded border border-line bg-surface px-1.5 py-1 text-xs text-ink-muted focus:border-accent focus:outline-none"
                        >
                          {TASK_STATUSES.map((option) => (
                            <option key={option} value={option}>
                              {TASK_STATUS[option].label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Editar tarefa"
        description={editing ? editing.project.name : undefined}
      >
        {editing ? (
          <div className="flex flex-col gap-4">
            <TaskForm
              action={updateTaskAction}
              projects={projects}
              users={users}
              lockedProjectId={editing.project.id}
              values={{
                id: editing.id,
                title: editing.title,
                description: editing.description,
                assignedUserId: editing.assignee?.id ?? null,
                priority: editing.priority,
                status: editing.status,
                deadline: editing.deadline,
              }}
              submitLabel="Salvar alterações"
              onDone={() => setEditing(null)}
            />
            <div className="flex justify-end border-t border-line pt-3">
              <ConfirmAction
                action={deleteTaskAction}
                hiddenFields={{ taskId: editing.id }}
                title="Excluir tarefa"
                description={`"${editing.title}" será removida do projeto.`}
                triggerLabel="Excluir tarefa"
              />
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

/** Botão + diálogo de nova tarefa. Fica fora do quadro para reuso nas telas. */
export function NewTaskButton({
  projects,
  users,
  lockedProjectId,
  label = "Nova tarefa",
}: {
  projects: ReadonlyArray<ProjectOption>;
  users: ReadonlyArray<UserOption>;
  lockedProjectId?: string;
  label?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="primary" size="sm" onClick={() => setIsOpen(true)}>
        <Plus className="size-3.5" aria-hidden />
        {label}
      </Button>
      <Modal open={isOpen} onClose={() => setIsOpen(false)} title="Nova tarefa">
        <TaskForm
          action={createTaskAction}
          projects={projects}
          users={users}
          lockedProjectId={lockedProjectId}
          onDone={() => setIsOpen(false)}
        />
      </Modal>
    </>
  );
}
