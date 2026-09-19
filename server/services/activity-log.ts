/**
 * Registro de atividades. Toda escrita relevante do sistema passa por aqui,
 * e é isto que alimenta a timeline do projeto e a página de histórico.
 *
 * A frase é montada na hora de gravar, com o nome de quem fez e os valores
 * daquele momento. É de propósito: a timeline conta o que aconteceu naquele
 * dia, e não deve mudar de texto porque o projeto foi renomeado depois.
 *
 * Falha em registrar não derruba a operação: perder uma linha de histórico é
 * ruim, perder o pagamento que acabou de ser lançado é bem pior.
 */

import { createLogger } from "@/lib/logger";
import { prisma } from "@/server/db/prisma";
import type { ActivityAction, ActivityEntity } from "@/lib/domain/enums";

const logger = createLogger("activity");

export interface ActivityInput {
  userId: string;
  /** Preenchido sempre que a ação aconteceu dentro de um projeto. */
  projectId?: string | null;
  entityType: ActivityEntity;
  entityId: string;
  action: ActivityAction;
  /** Frase já pronta, começando pelo nome de quem fez. */
  description: string;
}

export async function logActivity(input: ActivityInput): Promise<void> {
  try {
    await prisma.activity.create({
      data: {
        userId: input.userId,
        projectId: input.projectId ?? null,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        description: input.description,
      },
    });
  } catch {
    logger.error("falha ao registrar atividade");
  }
}

/** Várias atividades de uma vez (ex.: criar projeto já com as parcelas). */
export async function logActivities(inputs: ReadonlyArray<ActivityInput>): Promise<void> {
  if (inputs.length === 0) return;
  try {
    await prisma.activity.createMany({
      data: inputs.map((input) => ({
        userId: input.userId,
        projectId: input.projectId ?? null,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        description: input.description,
      })),
    });
  } catch {
    logger.error("falha ao registrar atividades");
  }
}
