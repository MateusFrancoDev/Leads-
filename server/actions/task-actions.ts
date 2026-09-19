"use server";

/** Escrita de tarefas, incluindo o arrastar do Kanban. */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { TASK_STATUS } from "@/lib/domain/enums";
import { createLogger } from "@/lib/logger";
import { taskSchema, taskStatusSchema } from "@/lib/schemas/work";
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
  createTask,
  deleteTask,
  findTask,
  moveTask,
  updateTask,
} from "@/server/repositories/task-repository";
import { logActivity } from "@/server/services/activity-log";

const logger = createLogger("task-action");

function revalidateTaskPages(projectId: string): void {
  revalidatePath("/tarefas");
  revalidatePath("/dashboard");
  revalidatePath("/hoje");
  revalidatePath(`/projetos/${projectId}`);
}

export async function createTaskAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = taskSchema.safeParse(formValues(formData));
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const task = await createTask(parsed.data, user.id);

    await logActivity({
      userId: user.id,
      projectId: task.projectId,
      entityType: "TASK",
      entityId: task.id,
      action: "CREATED",
      description: `${user.name} criou a tarefa "${task.title}"${
        task.assignee ? ` para ${task.assignee.name}` : ""
      }.`,
    });

    revalidateTaskPages(task.projectId);
    return success("Tarefa criada.", task.id);
  } catch (error) {
    logger.error("falha ao criar tarefa");
    return failure(error);
  }
}

export async function updateTaskAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = taskSchema.safeParse(formValues(formData));
  if (!parsed.success) return invalidInput(parsed.error);

  const taskId = z.string().min(1).safeParse(formData.get("taskId"));
  if (!taskId.success) return { status: "error", message: "Tarefa inválida." };

  try {
    const before = await findTask(taskId.data);
    if (!before) return { status: "error", message: "Tarefa não encontrada." };

    const task = await updateTask(taskId.data, parsed.data, before.status === "DONE");
    const becameDone = before.status !== "DONE" && task.status === "DONE";

    await logActivity({
      userId: user.id,
      projectId: task.projectId,
      entityType: "TASK",
      entityId: task.id,
      action: becameDone ? "TASK_COMPLETED" : "UPDATED",
      description: becameDone
        ? `${user.name} concluiu a tarefa "${task.title}".`
        : `${user.name} atualizou a tarefa "${task.title}".`,
    });

    revalidateTaskPages(task.projectId);
    return success(becameDone ? "Tarefa concluída." : "Tarefa atualizada.");
  } catch (error) {
    logger.error("falha ao atualizar tarefa");
    return failure(error);
  }
}

/** Soltar o cartão em outra coluna. Também usado pelo seletor do celular. */
export async function moveTaskAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = taskStatusSchema.safeParse(formValues(formData));
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const moved = await moveTask(parsed.data.taskId, parsed.data.status, parsed.data.position);
    if (!moved) return { status: "error", message: "Tarefa não encontrada." };

    if (moved.previousStatus !== parsed.data.status) {
      const becameDone = parsed.data.status === "DONE";
      await logActivity({
        userId: user.id,
        projectId: moved.projectId,
        entityType: "TASK",
        entityId: parsed.data.taskId,
        action: becameDone ? "TASK_COMPLETED" : "STATUS_CHANGED",
        description: becameDone
          ? `${user.name} concluiu a tarefa "${moved.title}".`
          : `${user.name} moveu a tarefa "${moved.title}" para ${TASK_STATUS[parsed.data.status].label}.`,
      });
    }

    revalidateTaskPages(moved.projectId);
    return success(`Tarefa em ${TASK_STATUS[parsed.data.status].label}.`);
  } catch (error) {
    logger.error("falha ao mover tarefa");
    return failure(error);
  }
}

export async function deleteTaskAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = z.object({ taskId: id }).safeParse(formValues(formData));
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const task = await findTask(parsed.data.taskId);
    if (!task) return { status: "error", message: "Tarefa não encontrada." };

    await deleteTask(task.id);

    await logActivity({
      userId: user.id,
      projectId: task.projectId,
      entityType: "TASK",
      entityId: task.id,
      action: "DELETED",
      description: `${user.name} excluiu a tarefa "${task.title}".`,
    });

    revalidateTaskPages(task.projectId);
    return success("Tarefa excluída.");
  } catch (error) {
    logger.error("falha ao excluir tarefa");
    return failure(error);
  }
}
