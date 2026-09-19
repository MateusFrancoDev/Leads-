/**
 * Busca global: uma pergunta, três respostas (clientes, projetos, tarefas).
 *
 * O termo é procurado também nos telefones, então digitar "98765" acha o
 * cliente pelo WhatsApp. Como o banco guarda só os dígitos, a busca tira a
 * formatação antes de comparar.
 */

import { prisma } from "@/server/db/prisma";
import type { ClientStatusValue, ProjectStatusValue, TaskStatusValue } from "@/lib/domain/enums";

export interface GlobalSearchResults {
  clients: Array<{
    id: string;
    name: string;
    company: string | null;
    email: string | null;
    phone: string | null;
    whatsapp: string | null;
    status: ClientStatusValue;
  }>;
  projects: Array<{
    id: string;
    name: string;
    status: ProjectStatusValue;
    valueCents: number;
    deadline: Date | null;
    client: { id: string; name: string };
  }>;
  tasks: Array<{
    id: string;
    title: string;
    status: TaskStatusValue;
    deadline: Date | null;
    project: { id: string; name: string };
  }>;
  total: number;
}

/** Teto por seção: a busca global mostra os melhores, não todos. */
const LIMIT = 12;

export async function searchEverything(term: string): Promise<GlobalSearchResults> {
  const text = term.trim();
  const digits = text.replace(/\D/g, "");
  const contains = { contains: text, mode: "insensitive" } as const;

  const [clients, projects, tasks] = await Promise.all([
    prisma.client.findMany({
      where: {
        OR: [
          { name: contains },
          { company: contains },
          { email: contains },
          ...(digits.length >= 4
            ? [{ phone: { contains: digits } }, { whatsapp: { contains: digits } }, { document: { contains: digits } }]
            : []),
        ],
      },
      select: {
        id: true,
        name: true,
        company: true,
        email: true,
        phone: true,
        whatsapp: true,
        status: true,
      },
      take: LIMIT,
      orderBy: { name: "asc" },
    }),
    prisma.project.findMany({
      where: {
        OR: [
          { name: contains },
          { description: contains },
          { client: { name: contains } },
          { client: { company: contains } },
        ],
      },
      select: {
        id: true,
        name: true,
        status: true,
        valueCents: true,
        deadline: true,
        client: { select: { id: true, name: true } },
      },
      take: LIMIT,
      orderBy: { createdAt: "desc" },
    }),
    prisma.task.findMany({
      where: { OR: [{ title: contains }, { description: contains }] },
      select: {
        id: true,
        title: true,
        status: true,
        deadline: true,
        project: { select: { id: true, name: true } },
      },
      take: LIMIT,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    clients,
    projects,
    tasks,
    total: clients.length + projects.length + tasks.length,
  };
}
