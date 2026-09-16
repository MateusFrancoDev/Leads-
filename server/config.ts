/**
 * Configuracao de runtime do servidor: le e valida variaveis de ambiente uma
 * unica vez e deriva os limites de custo (TTL de cache, concorrencia, timeout).
 *
 * Nada aqui pode ser importado por Client Components - sao segredos de servidor.
 */

import { z } from "zod";

export const LEAD_PROVIDER_NAMES = ["google_places", "openstreetmap", "mock"] as const;
export type LeadProviderName = (typeof LEAD_PROVIDER_NAMES)[number];

export const AI_PROVIDER_NAMES = ["anthropic", "mock", "none"] as const;
export type AiProviderName = (typeof AI_PROVIDER_NAMES)[number];

export const AI_EFFORT_LEVELS = ["low", "medium", "high", "xhigh", "max"] as const;
export type AiEffort = (typeof AI_EFFORT_LEVELS)[number];

/**
 * Preco por milhao de tokens, usado apenas para estimar custo na interface.
 * Modelo fora desta tabela simplesmente nao exibe estimativa.
 */
const MODEL_PRICING: Readonly<Record<string, { input: number; output: number }>> = {
  "claude-opus-5": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number | null {
  const price = MODEL_PRICING[model];
  if (!price) return null;
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
}

const envSchema = z.object({
  DATABASE_URL: z.string().optional(),
  LEAD_PROVIDER: z.enum(LEAD_PROVIDER_NAMES).default("mock"),
  GOOGLE_PLACES_API_KEY: z.string().optional(),
  SEARCH_CACHE_TTL_HOURS: z.coerce.number().positive().default(24),
  EXTERNAL_CONCURRENCY: z.coerce.number().int().min(1).max(20).default(4),
  EXTERNAL_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30_000).default(8_000),
  MAX_RESULTS_PER_SEARCH: z.coerce.number().int().min(1).max(200).default(60),
  ENRICHMENT_TTL_HOURS: z.coerce.number().positive().default(24 * 7),
  WEBSITE_ANALYSIS_TTL_HOURS: z.coerce.number().positive().default(24 * 7),
  MAX_EXPORT_ROWS: z.coerce.number().int().min(1).max(10_000).default(2_000),
  AI_PROVIDER: z.enum(AI_PROVIDER_NAMES).default("none"),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default("claude-opus-5"),
  AI_EFFORT: z.enum(AI_EFFORT_LEVELS).default("low"),
  AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(256).max(16_000).default(2_000),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(50).default(5),
});

function readEnv() {
  const parsed = envSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    LEAD_PROVIDER: process.env.LEAD_PROVIDER || undefined,
    GOOGLE_PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY || undefined,
    SEARCH_CACHE_TTL_HOURS: process.env.SEARCH_CACHE_TTL_HOURS || undefined,
    EXTERNAL_CONCURRENCY: process.env.EXTERNAL_CONCURRENCY || undefined,
    EXTERNAL_TIMEOUT_MS: process.env.EXTERNAL_TIMEOUT_MS || undefined,
    MAX_RESULTS_PER_SEARCH: process.env.MAX_RESULTS_PER_SEARCH || undefined,
    ENRICHMENT_TTL_HOURS: process.env.ENRICHMENT_TTL_HOURS || undefined,
    WEBSITE_ANALYSIS_TTL_HOURS: process.env.WEBSITE_ANALYSIS_TTL_HOURS || undefined,
    MAX_EXPORT_ROWS: process.env.MAX_EXPORT_ROWS || undefined,
    AI_PROVIDER: process.env.AI_PROVIDER || undefined,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || undefined,
    AI_MODEL: process.env.AI_MODEL || undefined,
    AI_EFFORT: process.env.AI_EFFORT || undefined,
    AI_MAX_OUTPUT_TOKENS: process.env.AI_MAX_OUTPUT_TOKENS || undefined,
    DB_POOL_MAX: process.env.DB_POOL_MAX || undefined,
  });

  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Variaveis de ambiente invalidas: ${fields}. Consulte .env.example.`);
  }
  return parsed.data;
}

const env = readEnv();

export const serverConfig = {
  databaseUrl: env.DATABASE_URL ?? "",
  isDatabaseConfigured: Boolean(env.DATABASE_URL),

  /**
   * Conexoes simultaneas por instancia. Poolers (Supabase) e bancos pequenos
   * derrubam conexoes quando uma unica pagina abre consultas demais em
   * paralelo - o pool enfileira em vez de estourar o limite.
   */
  databasePoolMax: env.DB_POOL_MAX,

  provider: {
    name: env.LEAD_PROVIDER,
    googlePlacesApiKey: env.GOOGLE_PLACES_API_KEY ?? "",
  },

  /** Uma pesquisa repetida dentro deste prazo nao chama a API de novo. */
  searchCacheTtlMs: env.SEARCH_CACHE_TTL_HOURS * 60 * 60 * 1000,

  /** Teto de leads trazidos do provider por pesquisa. */
  maxResultsPerSearch: env.MAX_RESULTS_PER_SEARCH,

  /** Um lead enriquecido ha menos tempo que isto nao volta ao provider. */
  enrichmentTtlMs: env.ENRICHMENT_TTL_HOURS * 60 * 60 * 1000,

  /** Um site analisado ha menos tempo que isto nao e baixado de novo. */
  websiteAnalysisTtlMs: env.WEBSITE_ANALYSIS_TTL_HOURS * 60 * 60 * 1000,

  /** Teto de linhas por exportacao CSV. */
  maxExportRows: env.MAX_EXPORT_ROWS,

  ai: {
    provider: env.AI_PROVIDER,
    apiKey: env.ANTHROPIC_API_KEY ?? "",
    model: env.AI_MODEL,
    /** Nivel de esforco: menor = mais barato. Analise de lead e tarefa simples. */
    effort: env.AI_EFFORT,
    maxOutputTokens: env.AI_MAX_OUTPUT_TOKENS,
  },

  external: {
    concurrency: env.EXTERNAL_CONCURRENCY,
    timeoutMs: env.EXTERNAL_TIMEOUT_MS,
    retry: { retries: 2, baseDelayMs: 400 },
  },
} as const;

/**
 * Retrato da configuracao para a tela de Configuracoes.
 * Expoe apenas se cada chave existe - nunca o valor dela.
 */
export interface ConfigSummary {
  database: { configured: boolean; poolMax: number };
  leads: { provider: LeadProviderName; configured: boolean; maxResultsPerSearch: number };
  ai: { provider: AiProviderName; configured: boolean; model: string; effort: AiEffort };
  limits: {
    searchCacheHours: number;
    enrichmentTtlHours: number;
    websiteAnalysisTtlHours: number;
    concurrency: number;
    timeoutMs: number;
    maxExportRows: number;
  };
}

export function describeConfig(): ConfigSummary {
  const hours = (ms: number) => Math.round(ms / (60 * 60 * 1000));

  return {
    database: {
      configured: serverConfig.isDatabaseConfigured,
      poolMax: serverConfig.databasePoolMax,
    },
    leads: {
      provider: serverConfig.provider.name,
      // So o Google exige chave; mock e OpenStreetMap funcionam sem nada.
      configured:
        serverConfig.provider.name !== "google_places" ||
        serverConfig.provider.googlePlacesApiKey.length > 0,
      maxResultsPerSearch: serverConfig.maxResultsPerSearch,
    },
    ai: {
      provider: serverConfig.ai.provider,
      configured:
        serverConfig.ai.provider === "mock" ||
        (serverConfig.ai.provider === "anthropic" && serverConfig.ai.apiKey.length > 0),
      model: serverConfig.ai.model,
      effort: serverConfig.ai.effort,
    },
    limits: {
      searchCacheHours: hours(serverConfig.searchCacheTtlMs),
      enrichmentTtlHours: hours(serverConfig.enrichmentTtlMs),
      websiteAnalysisTtlHours: hours(serverConfig.websiteAnalysisTtlMs),
      concurrency: serverConfig.external.concurrency,
      timeoutMs: serverConfig.external.timeoutMs,
      maxExportRows: serverConfig.maxExportRows,
    },
  };
}
