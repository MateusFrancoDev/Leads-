/**
 * Anotações, arquivos, compromissos do calendário e histórico de atividades.
 * São tabelas simples que aparecem em várias telas - ficam juntas para não
 * espalhar quatro arquivos de dez linhas.
 */

import { prisma } from "@/server/db/prisma";
import type {
  ActivityEntity,
  EventTypeValue,
  FileCategoryValue,
} from "@/lib/domain/enums";
import type { CalendarEventInput, FileFilters, NoteInput } from "@/lib/schemas/work";

const AUTHOR = { select: { id: true, name: true, avatarUrl: true } } as const;

// ---------------------------------------------------------------- anotações

export async function createNote(data: NoteInput, userId: string) {
  return prisma.note.create({
    data: {
      content: data.content,
      projectId: data.projectId ?? null,
      clientId: data.clientId ?? null,
      userId,
    },
  });
}

export async function findNote(id: string) {
  return prisma.note.findUnique({
    where: { id },
    select: { id: true, projectId: true, clientId: true, userId: true },
  });
}

export async function deleteNote(id: string): Promise<void> {
  await prisma.note.delete({ where: { id } });
}

/** Anotações de um cliente, da mais recente para a mais antiga. */
export async function listClientNotes(clientId: string) {
  return prisma.note.findMany({
    where: { clientId },
    include: { user: AUTHOR, project: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
}

// ---------------------------------------------------------------- arquivos

export interface StoredFileRow {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  category: FileCategoryValue;
  createdAt: Date;
  user: { id: string; name: string } | null;
  project: { id: string; name: string } | null;
  client: { id: string; name: string } | null;
}

const FILE_SELECT = {
  id: true,
  name: true,
  mimeType: true,
  sizeBytes: true,
  category: true,
  createdAt: true,
  user: { select: { id: true, name: true } },
  project: { select: { id: true, name: true } },
  client: { select: { id: true, name: true } },
} as const;

export async function listFiles(filters: FileFilters): Promise<StoredFileRow[]> {
  return prisma.storedFile.findMany({
    where: {
      category: filters.category,
      projectId: filters.projectId,
      clientId: filters.clientId,
      ...(filters.q ? { name: { contains: filters.q, mode: "insensitive" } } : {}),
    },
    select: FILE_SELECT,
    orderBy: { createdAt: "desc" },
  });
}

export async function listClientFiles(clientId: string): Promise<StoredFileRow[]> {
  // Inclui os arquivos dos projetos do cliente: quem abre a ficha quer tudo.
  return prisma.storedFile.findMany({
    where: { OR: [{ clientId }, { project: { clientId } }] },
    select: FILE_SELECT,
    orderBy: { createdAt: "desc" },
  });
}

export async function createFileRecord(data: {
  name: string;
  path: string;
  mimeType: string;
  sizeBytes: number;
  category: FileCategoryValue;
  projectId?: string | null;
  clientId?: string | null;
  userId: string;
}) {
  return prisma.storedFile.create({ data });
}

/** Inclui o caminho em disco: só o service de arquivos deve usar. */
export async function findFileWithPath(id: string) {
  return prisma.storedFile.findUnique({
    where: { id },
    select: { id: true, name: true, path: true, mimeType: true, projectId: true, clientId: true },
  });
}

export async function deleteFileRecord(id: string): Promise<void> {
  await prisma.storedFile.delete({ where: { id } });
}

export async function countFiles(): Promise<number> {
  return prisma.storedFile.count();
}

// ---------------------------------------------------------------- calendário

export interface CalendarEventRow {
  id: string;
  title: string;
  description: string | null;
  type: EventTypeValue;
  startsAt: Date;
  allDay: boolean;
  project: { id: string; name: string } | null;
  client: { id: string; name: string } | null;
}

export async function listEventsBetween(from: Date, to: Date): Promise<CalendarEventRow[]> {
  return prisma.calendarEvent.findMany({
    where: { startsAt: { gte: from, lte: to } },
    select: {
      id: true,
      title: true,
      description: true,
      type: true,
      startsAt: true,
      allDay: true,
      project: { select: { id: true, name: true } },
      client: { select: { id: true, name: true } },
    },
    orderBy: { startsAt: "asc" },
  });
}

export async function createEvent(data: CalendarEventInput, userId: string) {
  return prisma.calendarEvent.create({
    data: {
      title: data.title,
      description: data.description ?? null,
      type: data.type,
      startsAt: data.startsAt,
      allDay: data.allDay,
      projectId: data.projectId ?? null,
      clientId: data.clientId ?? null,
      userId,
    },
  });
}

export async function deleteEvent(id: string): Promise<void> {
  await prisma.calendarEvent.delete({ where: { id } });
}

// ---------------------------------------------------------------- histórico

export interface ActivityRow {
  id: string;
  description: string;
  entityType: ActivityEntity;
  entityId: string;
  createdAt: Date;
  user: { id: string; name: string; avatarUrl: string | null } | null;
  project: { id: string; name: string } | null;
}

export async function listActivities(options: {
  limit: number;
  userId?: string;
  entityType?: ActivityEntity;
}): Promise<ActivityRow[]> {
  return prisma.activity.findMany({
    where: { userId: options.userId, entityType: options.entityType },
    select: {
      id: true,
      description: true,
      entityType: true,
      entityId: true,
      createdAt: true,
      user: AUTHOR,
      project: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: options.limit,
  });
}
