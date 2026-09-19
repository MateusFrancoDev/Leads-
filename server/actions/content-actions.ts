"use server";

/** Escrita de anotações, arquivos e compromissos do calendário. */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { formatDateTime } from "@/lib/dates";
import { createLogger } from "@/lib/logger";
import { calendarEventSchema, fileMetaSchema, noteSchema } from "@/lib/schemas/work";
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
  createEvent,
  createFileRecord,
  createNote,
  deleteEvent,
  deleteFileRecord,
  deleteNote,
  findFileWithPath,
  findNote,
} from "@/server/repositories/content-repository";
import { logActivity } from "@/server/services/activity-log";
import { removeStoredFile, saveUpload } from "@/server/services/file-storage";

const logger = createLogger("content-action");

function revalidateFor(projectId?: string | null, clientId?: string | null): void {
  if (projectId) revalidatePath(`/projetos/${projectId}`);
  if (clientId) revalidatePath(`/clientes/${clientId}`);
  revalidatePath("/historico");
}

// ---------------------------------------------------------------- anotações

export async function createNoteAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = noteSchema.safeParse(formValues(formData));
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const note = await createNote(parsed.data, user.id);

    await logActivity({
      userId: user.id,
      projectId: note.projectId,
      entityType: "NOTE",
      entityId: note.id,
      action: "NOTE_ADDED",
      description: `${user.name} adicionou uma anotação.`,
    });

    revalidateFor(note.projectId, note.clientId);
    return success("Anotação adicionada.");
  } catch (error) {
    logger.error("falha ao criar anotação");
    return failure(error);
  }
}

export async function deleteNoteAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = z.object({ noteId: id }).safeParse(formValues(formData));
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const note = await findNote(parsed.data.noteId);
    if (!note) return { status: "error", message: "Anotação não encontrada." };

    await deleteNote(note.id);

    await logActivity({
      userId: user.id,
      projectId: note.projectId,
      entityType: "NOTE",
      entityId: note.id,
      action: "DELETED",
      description: `${user.name} removeu uma anotação.`,
    });

    revalidateFor(note.projectId, note.clientId);
    return success("Anotação removida.");
  } catch (error) {
    logger.error("falha ao excluir anotação");
    return failure(error);
  }
}

// ---------------------------------------------------------------- arquivos

export async function uploadFileAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = fileMetaSchema.safeParse({
    projectId: formData.get("projectId") || undefined,
    clientId: formData.get("clientId") || undefined,
    category: formData.get("category") || undefined,
  });
  if (!parsed.success) return invalidInput(parsed.error);

  const upload = formData.get("file");
  if (!(upload instanceof File) || upload.size === 0) {
    return { status: "error", message: "Escolha um arquivo para enviar." };
  }

  try {
    // Uma pasta por projeto (ou por cliente): facilita achar as coisas no disco.
    const saved = await saveUpload(upload, parsed.data.projectId ?? parsed.data.clientId ?? "geral");

    const record = await createFileRecord({
      ...saved,
      category: parsed.data.category,
      projectId: parsed.data.projectId ?? null,
      clientId: parsed.data.clientId ?? null,
      userId: user.id,
    });

    await logActivity({
      userId: user.id,
      projectId: record.projectId,
      entityType: "FILE",
      entityId: record.id,
      action: "FILE_ADDED",
      description: `${user.name} adicionou o arquivo ${record.name}.`,
    });

    revalidateFor(record.projectId, record.clientId);
    revalidatePath("/arquivos");
    return success(`Arquivo ${record.name} adicionado.`);
  } catch (error) {
    logger.error("falha no upload");
    return failure(error);
  }
}

export async function deleteFileAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = z.object({ fileId: id }).safeParse(formValues(formData));
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const file = await findFileWithPath(parsed.data.fileId);
    if (!file) return { status: "error", message: "Arquivo não encontrado." };

    // Primeiro o registro: um órfão em disco é menos grave que um registro
    // apontando para um arquivo que não existe mais.
    await deleteFileRecord(file.id);
    await removeStoredFile(file.path);

    await logActivity({
      userId: user.id,
      projectId: file.projectId,
      entityType: "FILE",
      entityId: file.id,
      action: "FILE_REMOVED",
      description: `${user.name} removeu o arquivo ${file.name}.`,
    });

    revalidateFor(file.projectId, file.clientId);
    revalidatePath("/arquivos");
    return success("Arquivo excluído.");
  } catch (error) {
    logger.error("falha ao excluir arquivo");
    return failure(error);
  }
}

// ---------------------------------------------------------------- calendário

export async function createEventAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = calendarEventSchema.safeParse(formValues(formData));
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    const event = await createEvent(parsed.data, user.id);

    await logActivity({
      userId: user.id,
      projectId: event.projectId,
      entityType: "EVENT",
      entityId: event.id,
      action: "CREATED",
      description: `${user.name} agendou "${event.title}" para ${formatDateTime(event.startsAt)}.`,
    });

    revalidatePath("/calendario");
    revalidatePath("/hoje");
    revalidateFor(event.projectId, event.clientId);
    return success("Compromisso agendado.");
  } catch (error) {
    logger.error("falha ao criar compromisso");
    return failure(error);
  }
}

export async function deleteEventAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();

  const parsed = z.object({ eventId: id }).safeParse(formValues(formData));
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    await deleteEvent(parsed.data.eventId);
    revalidatePath("/calendario");
    revalidatePath("/hoje");
    return success("Compromisso removido.");
  } catch (error) {
    logger.error("falha ao excluir compromisso");
    return failure(error);
  }
}
