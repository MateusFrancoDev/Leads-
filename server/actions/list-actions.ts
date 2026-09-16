"use server";

/** Server Actions das listas de prospeccao. */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { userMessage } from "@/lib/errors";
import { createLogger } from "@/lib/logger";
import { formDataToObject, listFormSchema } from "@/lib/validation";
import {
  addLeadToList,
  createProspectingList,
  deleteProspectingList,
  removeLeadFromList,
} from "@/server/repositories/list-repository";

const logger = createLogger("list-action");

export interface ListActionState {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string>;
}

export const initialListActionState: ListActionState = { status: "idle" };

export async function createListAction(
  _previous: ListActionState,
  formData: FormData,
): Promise<ListActionState> {
  const parsed = listFormSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "form");
      fieldErrors[field] ??= issue.message;
    }
    return { status: "error", message: "Revise os campos destacados.", fieldErrors };
  }

  try {
    const list = await createProspectingList(parsed.data);
    revalidatePath("/listas");
    return { status: "success", message: `Lista "${list.name}" criada.` };
  } catch (error) {
    logger.error("falha ao criar lista");
    return { status: "error", message: userMessage(error) };
  }
}

const listLeadSchema = z.object({
  listId: z.string().min(1),
  leadId: z.string().min(1),
});

export async function addLeadToListAction(
  _previous: ListActionState,
  formData: FormData,
): Promise<ListActionState> {
  const parsed = listLeadSchema.safeParse({
    listId: formData.get("listId"),
    leadId: formData.get("leadId"),
  });
  if (!parsed.success) return { status: "error", message: "Selecione uma lista." };

  try {
    await addLeadToList(parsed.data.listId, parsed.data.leadId);
    revalidatePath(`/leads/${parsed.data.leadId}`);
    revalidatePath("/listas");
    return { status: "success", message: "Lead adicionado a lista." };
  } catch (error) {
    logger.error("falha ao adicionar a lista");
    return { status: "error", message: userMessage(error) };
  }
}

export async function removeLeadFromListAction(
  _previous: ListActionState,
  formData: FormData,
): Promise<ListActionState> {
  const parsed = listLeadSchema.safeParse({
    listId: formData.get("listId"),
    leadId: formData.get("leadId"),
  });
  if (!parsed.success) return { status: "error", message: "Dados invalidos." };

  try {
    await removeLeadFromList(parsed.data.listId, parsed.data.leadId);
    revalidatePath(`/listas/${parsed.data.listId}`);
    revalidatePath(`/leads/${parsed.data.leadId}`);
    return { status: "success", message: "Lead removido da lista." };
  } catch (error) {
    logger.error("falha ao remover da lista");
    return { status: "error", message: userMessage(error) };
  }
}

export async function deleteListAction(
  _previous: ListActionState,
  formData: FormData,
): Promise<ListActionState> {
  const parsed = z.object({ listId: z.string().min(1) }).safeParse({
    listId: formData.get("listId"),
  });
  if (!parsed.success) return { status: "error", message: "Lista invalida." };

  try {
    await deleteProspectingList(parsed.data.listId);
  } catch (error) {
    logger.error("falha ao excluir lista");
    return { status: "error", message: userMessage(error) };
  }

  // A pagina da lista deixou de existir: volta para o indice.
  revalidatePath("/listas");
  redirect("/listas");
}
