"use server";

/**
 * Escrita de projetos: criação, edição, Kanban, progresso, briefing e contrato.
 * Cada mudança relevante vira uma linha no histórico, e é ela que monta a
 * timeline da página do projeto.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { formatDate } from "@/lib/dates";
import { CONTRACT_STATUS, CONTRACT_STATUSES, PROJECT_STATUS } from "@/lib/domain/enums";
import { createLogger } from "@/lib/logger";
import { formatMoney } from "@/lib/money";
import {
  briefingSchema,
  projectFormSchema,
  projectProgressSchema,
  projectStatusSchema,
} from "@/lib/schemas/crm";
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
  createProject,
  deleteProject,
  findProjectSummary,
  updateContractStatus,
  updateProject,
  updateProjectProgress,
  updateProjectStatus,
  upsertBriefing,
} from "@/server/repositories/project-repository";
import { logActivity } from "@/server/services/activity-log";

const logger = createLogger("project-action");

function revalidateProjectPages(projectId?: string, clientId?: string): void {
  revalidatePath("/projetos");
  revalidatePath("/dashboard");
  revalidatePath("/hoje");
  revalidatePath("/calendario");
  if (projectId) revalidatePath(`/projetos/${projectId}`);
  if (clientId) revalidatePath(`/clientes/${clientId}`);
}

export async function createProjectAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = projectFormSchema.safeParse(formValues(formData));
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const project = await createProject(parsed.data);

    await logActivity({
      userId: user.id,
      projectId: project.id,
      entityType: "PROJECT",
      entityId: project.id,
      action: "CREATED",
      description: `${user.name} criou o projeto ${project.name}${
        project.valueCents > 0 ? ` no valor de ${formatMoney(project.valueCents)}` : ""
      }.`,
    });

    revalidateProjectPages(project.id, project.clientId);
    return success(`Projeto ${project.name} criado.`, project.id);
  } catch (error) {
    logger.error("falha ao criar projeto");
    return failure(error);
  }
}

export async function updateProjectAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = projectFormSchema
    .safeParse(formValues(formData));
  if (!parsed.success) return invalidInput(parsed.error);

  const projectId = z.string().min(1).safeParse(formData.get("projectId"));
  if (!projectId.success) return { status: "error", message: "Projeto inválido." };

  try {
    const before = await findProjectSummary(projectId.data);
    if (!before) return { status: "error", message: "Projeto não encontrado." };

    const project = await updateProject(projectId.data, parsed.data, before.status === "COMPLETED");

    // Uma mudança de etapa e uma mudança de prazo contam histórias diferentes;
    // registrar as duas separadamente deixa a timeline útil.
    if (before.status !== project.status) {
      await logActivity({
        userId: user.id,
        projectId: project.id,
        entityType: "PROJECT",
        entityId: project.id,
        action: "STATUS_CHANGED",
        description: `${user.name} alterou o status para "${PROJECT_STATUS[project.status].label}".`,
      });
    }
    if (before.deadline?.getTime() !== project.deadline?.getTime()) {
      await logActivity({
        userId: user.id,
        projectId: project.id,
        entityType: "PROJECT",
        entityId: project.id,
        action: "DEADLINE_CHANGED",
        description: project.deadline
          ? `${user.name} definiu o prazo para ${formatDate(project.deadline)}.`
          : `${user.name} removeu o prazo do projeto.`,
      });
    }
    if (before.status === project.status && before.deadline?.getTime() === project.deadline?.getTime()) {
      await logActivity({
        userId: user.id,
        projectId: project.id,
        entityType: "PROJECT",
        entityId: project.id,
        action: "UPDATED",
        description: `${user.name} atualizou o projeto ${project.name}.`,
      });
    }

    revalidateProjectPages(project.id, project.clientId);
    return success("Projeto atualizado.", project.id);
  } catch (error) {
    logger.error("falha ao atualizar projeto");
    return failure(error);
  }
}

/** Arrastar um cartão no Kanban de projetos. */
export async function moveProjectAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = projectStatusSchema.safeParse(formValues(formData));
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const before = await findProjectSummary(parsed.data.projectId);
    if (!before) return { status: "error", message: "Projeto não encontrado." };
    if (before.status === parsed.data.status) return success("Nada mudou.");

    const project = await updateProjectStatus(parsed.data.projectId, parsed.data.status);
    if (!project) return { status: "error", message: "Projeto não encontrado." };

    await logActivity({
      userId: user.id,
      projectId: project.id,
      entityType: "PROJECT",
      entityId: project.id,
      action: "STATUS_CHANGED",
      description: `${user.name} alterou o status para "${PROJECT_STATUS[project.status].label}".`,
    });

    revalidateProjectPages(project.id, project.clientId);
    return success(`Projeto movido para ${PROJECT_STATUS[project.status].label}.`);
  } catch (error) {
    logger.error("falha ao mover projeto");
    return failure(error);
  }
}

export async function updateProgressAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = projectProgressSchema.safeParse(formValues(formData));
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const before = await findProjectSummary(parsed.data.projectId);
    if (!before) return { status: "error", message: "Projeto não encontrado." };

    const project = await updateProjectProgress(parsed.data.projectId, parsed.data.progress);

    if (before.progress !== project.progress) {
      await logActivity({
        userId: user.id,
        projectId: project.id,
        entityType: "PROJECT",
        entityId: project.id,
        action: "PROGRESS_CHANGED",
        description: `${user.name} alterou o progresso para ${project.progress}%.`,
      });
    }

    revalidateProjectPages(project.id, project.clientId);
    return success("Progresso atualizado.");
  } catch (error) {
    logger.error("falha ao atualizar progresso");
    return failure(error);
  }
}

export async function updateContractAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = z
    .object({ projectId: id, contractStatus: z.enum(CONTRACT_STATUSES) })
    .safeParse(formValues(formData));
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const project = await updateContractStatus(parsed.data.projectId, parsed.data.contractStatus);

    await logActivity({
      userId: user.id,
      projectId: project.id,
      entityType: "PROJECT",
      entityId: project.id,
      action: "UPDATED",
      description: `${user.name} marcou o contrato como "${CONTRACT_STATUS[parsed.data.contractStatus].label}".`,
    });

    revalidateProjectPages(project.id, project.clientId);
    return success("Contrato atualizado.");
  } catch (error) {
    logger.error("falha ao atualizar contrato");
    return failure(error);
  }
}

export async function saveBriefingAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = briefingSchema.safeParse(formValues(formData));
  if (!parsed.success) return invalidInput(parsed.error);

  const { projectId, ...data } = parsed.data;

  try {
    await upsertBriefing(projectId, data);

    await logActivity({
      userId: user.id,
      projectId,
      entityType: "PROJECT",
      entityId: projectId,
      action: "UPDATED",
      description: `${user.name} atualizou o briefing.`,
    });

    revalidatePath(`/projetos/${projectId}`);
    return success("Briefing salvo.");
  } catch (error) {
    logger.error("falha ao salvar briefing");
    return failure(error);
  }
}

export async function deleteProjectAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = z.object({ projectId: id }).safeParse(formValues(formData));
  if (!parsed.success) return invalidInput(parsed.error);

  let clientId: string | undefined;

  try {
    const project = await findProjectSummary(parsed.data.projectId);
    if (!project) return { status: "error", message: "Projeto não encontrado." };
    clientId = project.clientId;

    await deleteProject(project.id);

    await logActivity({
      userId: user.id,
      entityType: "PROJECT",
      entityId: project.id,
      action: "DELETED",
      description: `${user.name} excluiu o projeto ${project.name} do cliente ${project.client.name}.`,
    });
  } catch (error) {
    logger.error("falha ao excluir projeto");
    return failure(error);
  }

  revalidateProjectPages(undefined, clientId);
  redirect("/projetos");
}
