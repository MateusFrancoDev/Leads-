/**
 * Instancia unica do Prisma Client (driver adapter pg, exigido pelo Prisma 7).
 * Este e o unico ponto da aplicacao que cria conexao com o banco -
 * componentes e services sempre passam pelos repositorios.
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

// Em desenvolvimento o hot reload recria modulos; sem o cache global cada
// recarregamento abriria um novo pool de conexoes.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
