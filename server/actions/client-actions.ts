"use server";

/**
 * Escrita de clientes. Todo action aqui começa por requireUser(): a proteção
 * mora junto do dado, não no layout nem no proxy.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createLogger } from "@/lib/logger";
import { clientSchema } from "@/lib/schemas/crm";
import { CLIENT_STATUS } from "@/lib/domain/enums";
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
  createClient,
  deleteClient,
  findClient,
  updateClient,
} from "@/server/repositories/client-repository";
import { logActivity } from "@/server/services/activity-log";

const logger = createLogger("client-action");

/** Telas que mostram cliente e precisam ser atualizadas depois de uma escrita. */
function revalidateClientPages(clientId?: string): void {
  revalidatePath("/clientes");
  revalidatePath("/dashboard");
  if (clientId) revalidatePath(`/clientes/${clientId}`);
}

export async function createClientAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = clientSchema.safeParse(formValues(formData));
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const client = await createClient(parsed.data);

    await logActivity({
      userId: user.id,
      entityType: "CLIENT",
      entityId: client.id,
      action: "CREATED",
      description: `${user.name} cadastrou o cliente ${client.name}.`,
    });

    revalidateClientPages(client.id);
    return success(`Cliente ${client.name} cadastrado com sucesso.`, client.id);
  } catch (error) {
    logger.error("falha ao criar cliente");
    return failure(error);
  }
}

export async function updateClientAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = clientSchema.extend({ clientId: id }).safeParse(formValues(formData));
  if (!parsed.success) return invalidInput(parsed.error);

  const { clientId, ...data } = parsed.data;

  try {
    const before = await findClient(clientId);
    if (!before) return { status: "error", message: "Cliente não encontrado." };

    const client = await updateClient(clientId, data);

    // O histórico registra a mudança de estágio, que é a que interessa depois.
    const description =
      before.status !== client.status
        ? `${user.name} moveu o cliente ${client.name} para ${CLIENT_STATUS[client.status].label}.`
        : `${user.name} atualizou os dados do cliente ${client.name}.`;

    await logActivity({
      userId: user.id,
      entityType: "CLIENT",
      entityId: client.id,
      action: before.status !== client.status ? "STATUS_CHANGED" : "UPDATED",
      description,
    });

    revalidateClientPages(client.id);
    return success("Cliente atualizado.", client.id);
  } catch (error) {
    logger.error("falha ao atualizar cliente");
    return failure(error);
  }
}

export async function deleteClientAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = z.object({ clientId: id }).safeParse(formValues(formData));
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const client = await findClient(parsed.data.clientId);
    if (!client) return { status: "error", message: "Cliente não encontrado." };

    await deleteClient(client.id);

    // O registro do histórico fica, mesmo sem o cliente: é o que explica o sumiço.
    await logActivity({
      userId: user.id,
      entityType: "CLIENT",
      entityId: client.id,
      action: "DELETED",
      description: `${user.name} excluiu o cliente ${client.name} e tudo que estava ligado a ele.`,
    });
  } catch (error) {
    logger.error("falha ao excluir cliente");
    return failure(error);
  }

  revalidateClientPages();
  redirect("/clientes");
}
