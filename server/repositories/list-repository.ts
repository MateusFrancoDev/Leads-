/**
 * Acesso a dados das listas de prospeccao.
 * Uma lista e so um agrupamento nomeado de leads - os leads continuam unicos.
 */

import { AppError } from "@/lib/errors";
import { slugify } from "@/lib/normalize";
import { prisma } from "@/server/db/prisma";

export interface ProspectingListSummary {
  id: string;
  name: string;
  description: string | null;
  leadCount: number;
  updatedAt: Date;
}

export interface ProspectingListDetail {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function listProspectingLists(): Promise<ProspectingListSummary[]> {
  try {
    const rows = await prisma.prospectingList.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        updatedAt: true,
        _count: { select: { leads: true } },
      },
    });
    return rows.map(({ _count, ...list }) => ({ ...list, leadCount: _count.leads }));
  } catch (error) {
    throw new AppError("DATABASE_ERROR", undefined, error);
  }
}

export async function findProspectingList(id: string): Promise<ProspectingListDetail | null> {
  try {
    return await prisma.prospectingList.findUnique({
      where: { id },
      select: { id: true, name: true, description: true, createdAt: true, updatedAt: true },
    });
  } catch (error) {
    throw new AppError("DATABASE_ERROR", undefined, error);
  }
}

/** Cria a lista. O slug evita duas listas com o mesmo nome. */
export async function createProspectingList(input: {
  name: string;
  description?: string;
}): Promise<ProspectingListDetail> {
  const slug = slugify(input.name);
  try {
    const existing = await prisma.prospectingList.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (existing) throw new AppError("INVALID_INPUT", "Ja existe uma lista com esse nome.");

    return await prisma.prospectingList.create({
      data: { name: input.name, slug, description: input.description ?? null },
      select: { id: true, name: true, description: true, createdAt: true, updatedAt: true },
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("DATABASE_ERROR", undefined, error);
  }
}

export async function deleteProspectingList(id: string): Promise<void> {
  try {
    await prisma.prospectingList.delete({ where: { id } });
  } catch (error) {
    throw new AppError("DATABASE_ERROR", undefined, error);
  }
}

/** Adiciona o lead a lista. Repetir a acao nao duplica nem falha. */
export async function addLeadToList(listId: string, leadId: string): Promise<void> {
  try {
    await prisma.$transaction([
      prisma.prospectingListLead.upsert({
        where: { listId_leadId: { listId, leadId } },
        create: { listId, leadId },
        update: {},
      }),
      prisma.prospectingList.update({ where: { id: listId }, data: { updatedAt: new Date() } }),
    ]);
  } catch (error) {
    throw new AppError("DATABASE_ERROR", undefined, error);
  }
}

export async function removeLeadFromList(listId: string, leadId: string): Promise<void> {
  try {
    await prisma.prospectingListLead.deleteMany({ where: { listId, leadId } });
  } catch (error) {
    throw new AppError("DATABASE_ERROR", undefined, error);
  }
}

/** Listas que ja contem este lead - usado para marcar as opcoes na interface. */
export async function findListIdsForLead(leadId: string): Promise<string[]> {
  try {
    const rows = await prisma.prospectingListLead.findMany({
      where: { leadId },
      select: { listId: true },
    });
    return rows.map((row) => row.listId);
  } catch (error) {
    throw new AppError("DATABASE_ERROR", undefined, error);
  }
}
