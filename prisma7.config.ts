import { defineConfig } from "prisma/config";

// O CLI do Prisma nao carrega .env sozinho (v7). Usamos o carregador nativo do
// Node (20.6+) em vez de adicionar dotenv como dependencia.
try {
  process.loadEnvFile(".env");
} catch {
  // Sem .env local (ex.: CI) os valores ja vem do ambiente.
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Migrations precisam da conexao direta (Supabase: porta 5432).
    // A aplicacao usa DATABASE_URL (pooler) via driver adapter.
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
