/**
 * Pré-carregamento dos scripts e dos testes (`node --import ./scripts/ts/register.mjs`).
 *
 * Faz duas coisas, nesta ordem:
 *
 * 1. Carrega o .env. Precisa ser aqui, e não no corpo do script: os `import`
 *    do ESM são avaliados antes da primeira linha do arquivo, e server/config.ts
 *    lê as variáveis de ambiente no momento em que é importado. Sem isto,
 *    `npm run user:create` abriria o Prisma sem DATABASE_URL e falharia com
 *    ECONNREFUSED apontando para o localhost.
 * 2. Registra os hooks que resolvem o alias "@/..." e os imports sem extensão.
 */

import { register } from "node:module";

try {
  process.loadEnvFile(".env");
} catch {
  // Sem .env local (ex.: CI) os valores já vêm do ambiente.
}

register("./alias-loader.mjs", import.meta.url);
