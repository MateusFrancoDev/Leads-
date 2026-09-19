/**
 * Acesso à tabela de clientes e aos números que cada cliente gerou.
 *
 * Os totais por cliente são calculados no banco (groupBy), nunca carregando
 * todos os pagamentos para somar em memória - a lista de clientes precisa
 * continuar rápida com o sistema cheio.
 */

import { prisma } from "@/server/db/prisma";
import type { ClientFilters, ClientInput } from "@/lib/schemas/crm";
import type { ClientStatusValue } from "@/lib/domain/enums";

export interface ClientRow {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  city: string | null;
  state: string | null;
  status: ClientStatusValue;
  createdAt: Date;
  projectCount: number;
  /** Soma do valor combinado dos projetos, em centavos. */
  totalCents: number;
  receivedCents: number;
}

export async function listClients(filters: ClientFilters): Promise<ClientRow[]> {
  const clients = await prisma.client.findMany({
    where: {
      status: filters.status,
      ...(filters.q
        ? {
            OR: [
              { name: { contains: filters.q, mode: "insensitive" } },
              { company: { contains: filters.q, mode: "insensitive" } },
              { email: { contains: filters.q, mode: "insensitive" } },
              { phone: { contains: filters.q.replace(/\D/g, "") } },
              { whatsapp: { contains: filters.q.replace(/\D/g, "") } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      company: true,
      email: true,
      phone: true,
      whatsapp: true,
      city: true,
      state: true,
      status: true,
      createdAt: true,
      projects: { select: { id: true, valueCents: true } },
    },
    orderBy: filters.sort === "name" ? { name: "asc" } : { createdAt: "desc" },
  });

  const projectIds = clients.flatMap((client) => client.projects.map((project) => project.id));
  const receivedByProject = await sumReceivedByProject(projectIds);

  const rows: ClientRow[] = clients.map((client) => {
    const totalCents = client.projects.reduce((sum, project) => sum + project.valueCents, 0);
    const receivedCents = client.projects.reduce(
      (sum, project) => sum + (receivedByProject.get(project.id) ?? 0),
      0,
    );
    const { projects, ...rest } = client;
    return { ...rest, projectCount: projects.length, totalCents, receivedCents };
  });

  // Ordenar por receita depende dos totais, então só dá para fazer aqui.
  if (filters.sort === "revenue") rows.sort((a, b) => b.totalCents - a.totalCents);
  return rows;
}

/** Quanto já entrou por projeto. Uma consulta só, agregada no banco. */
async function sumReceivedByProject(projectIds: string[]): Promise<Map<string, number>> {
  if (projectIds.length === 0) return new Map();

  const groups = await prisma.payment.groupBy({
    by: ["projectId"],
    where: { projectId: { in: projectIds }, status: "PAID" },
    _sum: { amountCents: true },
  });

  return new Map(groups.map((group) => [group.projectId, group._sum.amountCents ?? 0]));
}

export async function findClient(id: string) {
  return prisma.client.findUnique({ where: { id } });
}

/** Clientes em ordem alfabética, para os selects de "cliente do projeto". */
export async function listClientOptions(): Promise<Array<{ id: string; name: string; company: string | null }>> {
  return prisma.client.findMany({
    select: { id: true, name: true, company: true },
    orderBy: { name: "asc" },
  });
}

export async function createClient(data: ClientInput) {
  return prisma.client.create({ data });
}

export async function updateClient(id: string, data: ClientInput) {
  return prisma.client.update({ where: { id }, data });
}

/** Apaga o cliente e, em cascata, tudo que pendurava nele. */
export async function deleteClient(id: string): Promise<void> {
  await prisma.client.delete({ where: { id } });
}

export async function countClients(): Promise<{ total: number; active: number }> {
  const [total, active] = await Promise.all([
    prisma.client.count(),
    prisma.client.count({ where: { status: "ACTIVE" } }),
  ]);
  return { total, active };
}
