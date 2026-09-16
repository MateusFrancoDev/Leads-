/**
 * Instância única do Prisma Client (driver adapter pg, exigido pelo Prisma 7).
 * Este e o único ponto da aplicação que cria conexão com o banco -
 * componentes e services sempre passam pelos repositórios.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { serverConfig } from "@/server/config";

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: serverConfig.databaseUrl,
    max: serverConfig.databasePoolMax,
    connectionTimeoutMillis: 10_000,
  });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "production" ? ["error"] : ["warn", "error"],
  });
}

// Em desenvolvimento o hot reload recria módulos; sem o cache global cada
// recarregamento abriria um novo pool de conexões.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
