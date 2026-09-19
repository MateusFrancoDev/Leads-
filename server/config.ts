/**
 * Configuração de runtime do servidor: lê e valida variáveis de ambiente uma
 * única vez e deriva os limites de custo (TTL de cache, concorrência, timeout).
 *
 * Nada aqui pode ser importado por Client Components - são segredos de servidor.
 */

import { z } from "zod";
import type { LeadSource } from "@/lib/leads/types";

/** User-Agent identificável exigido pelas políticas do Nominatim e do Overpass. */
export const OSM_USER_AGENT = "Prospecta/1.0 (prospeccao B2B local; leads-app)";

/** "true"/"false" (e 1/0) do .env viram boolean de verdade. */
const envBoolean = (fallback: boolean) =>
  z
    .enum(["true", "false", "1", "0"])
    .default(fallback ? "true" : "false")
    .transform((value) => value === "true" || value === "1");

const httpUrl = z.url({ protocol: /^https?$/ });

/**
 * Quem ANALISA os leads. Não confundir com a fonte que os ENCONTRA
 * (LEAD_PROVIDER / OPENSTREETMAP_ENABLED / CNPJ_ENABLED, logo acima).
 */
export const AI_PROVIDER_NAMES = ["gemini", "anthropic", "mock", "none"] as const;
export type AiProviderName = (typeof AI_PROVIDER_NAMES)[number];

export const AI_EFFORT_LEVELS = ["low", "medium", "high", "xhigh", "max"] as const;
export type AiEffort = (typeof AI_EFFORT_LEVELS)[number];

/**
 * Modelo usado quando AI_MODEL não é informado. Só existe um lugar com nome de
 * modelo no projeto: trocar aqui (ou no .env) troca em toda a aplicação.
 */
const DEFAULT_MODEL: Record<AiProviderName, string> = {
  gemini: "gemini-2.5-flash",
  anthropic: "claude-haiku-4-5",
  mock: "mock",
  none: "",
};

/**
 * Preço por milhão de tokens, usado apenas para estimar custo na interface.
 * Modelo fora desta tabela simplesmente não exibe estimativa.
 */
const MODEL_PRICING: Readonly<Record<string, { input: number; output: number }>> = {
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "gemini-2.5-flash-lite": { input: 0.1, output: 0.4 },
  "gemini-2.5-pro": { input: 1.25, output: 10 },
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
  LEAD_CACHE_TTL_HOURS: z.coerce.number().positive().default(168),
  OPENSTREETMAP_ENABLED: envBoolean(true),
  CNPJ_ENABLED: envBoolean(true),
  CNPJ_DATA_DIR: z.string().min(1).default("data/cnpj"),
  OVERPASS_API_URL: httpUrl.default("https://overpass-api.de/api/interpreter"),
  OVERPASS_FALLBACK_URL: httpUrl.optional(),
  OVERPASS_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(180_000).default(15_000),
  OVERPASS_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(5).default(3),
  NOMINATIM_API_URL: httpUrl.default("https://nominatim.openstreetmap.org"),
  // A política do Nominatim é de no máximo 1 requisição por segundo.
  NOMINATIM_MIN_INTERVAL_MS: z.coerce.number().int().min(1_000).max(60_000).default(1_100),
  WEBSITE_CRAWLER_ENABLED: envBoolean(true),
  WEBSITE_CRAWLER_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(30_000).default(5_000),
  WEBSITE_CRAWLER_MAX_PAGES: z.coerce.number().int().min(1).max(5).default(3),
  WEBSITE_CRAWLER_CONCURRENCY: z.coerce.number().int().min(1).max(10).default(4),
  WEBSITE_CRAWLER_MAX_RESPONSE_BYTES: z.coerce.number().int().min(10_000).max(10_000_000).default(2_000_000),
  WEBSITE_CRAWLER_MAX_SITES_PER_SEARCH: z.coerce.number().int().min(0).max(200).default(40),
  EXTERNAL_CONCURRENCY: z.coerce.number().int().min(1).max(20).default(4),
  EXTERNAL_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30_000).default(8_000),
  MAX_RESULTS_PER_SEARCH: z.coerce.number().int().min(1).max(500).default(200),
  ENRICHMENT_TTL_HOURS: z.coerce.number().positive().default(24 * 7),
  WEBSITE_ANALYSIS_TTL_HOURS: z.coerce.number().positive().default(24 * 7),
  MAX_EXPORT_ROWS: z.coerce.number().int().min(1).max(10_000).default(2_000),
  AI_PROVIDER: z.enum(AI_PROVIDER_NAMES).default("none"),
  GEMINI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL: z.string().min(1).optional(),
  AI_EFFORT: z.enum(AI_EFFORT_LEVELS).default("low"),
  AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(256).max(16_000).default(2_000),
  // Um lead analisado há menos tempo que isto não volta ao modelo sozinho.
  AI_ANALYSIS_TTL_HOURS: z.coerce.number().positive().default(24 * 30),
  AI_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(2),
  AI_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(120_000).default(30_000),
  AI_TEMPERATURE: z.coerce.number().min(0).max(1).default(0.2),
  // Gemini 2.5 cobra o "raciocínio" como saída. 0 desliga e é o padrão aqui.
  AI_THINKING_BUDGET: z.coerce.number().int().min(0).max(24_576).default(0),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(50).default(5),
  LEADS_MODULE_ENABLED: envBoolean(false),
  SESSION_MAX_AGE_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  STORAGE_DIR: z.string().min(1).default("storage"),
  MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(200).default(25),
});

function readEnv() {
  const env = (name: string) => process.env[name]?.trim() || undefined;
  const parsed = envSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    LEAD_CACHE_TTL_HOURS: env("LEAD_CACHE_TTL_HOURS"),
    OPENSTREETMAP_ENABLED: env("OPENSTREETMAP_ENABLED")?.toLowerCase(),
    CNPJ_ENABLED: env("CNPJ_ENABLED")?.toLowerCase(),
    CNPJ_DATA_DIR: env("CNPJ_DATA_DIR"),
    OVERPASS_API_URL: env("OVERPASS_API_URL"),
    OVERPASS_FALLBACK_URL: env("OVERPASS_FALLBACK_URL"),
    OVERPASS_TIMEOUT_MS: env("OVERPASS_TIMEOUT_MS"),
    OVERPASS_MAX_ATTEMPTS: env("OVERPASS_MAX_ATTEMPTS"),
    NOMINATIM_API_URL: env("NOMINATIM_API_URL"),
    NOMINATIM_MIN_INTERVAL_MS: env("NOMINATIM_MIN_INTERVAL_MS"),
    WEBSITE_CRAWLER_ENABLED: env("WEBSITE_CRAWLER_ENABLED")?.toLowerCase(),
    WEBSITE_CRAWLER_TIMEOUT_MS: env("WEBSITE_CRAWLER_TIMEOUT_MS"),
    WEBSITE_CRAWLER_MAX_PAGES: env("WEBSITE_CRAWLER_MAX_PAGES"),
    WEBSITE_CRAWLER_CONCURRENCY: env("WEBSITE_CRAWLER_CONCURRENCY"),
    WEBSITE_CRAWLER_MAX_RESPONSE_BYTES: env("WEBSITE_CRAWLER_MAX_RESPONSE_BYTES"),
    WEBSITE_CRAWLER_MAX_SITES_PER_SEARCH: env("WEBSITE_CRAWLER_MAX_SITES_PER_SEARCH"),
    EXTERNAL_CONCURRENCY: process.env.EXTERNAL_CONCURRENCY || undefined,
    EXTERNAL_TIMEOUT_MS: process.env.EXTERNAL_TIMEOUT_MS || undefined,
    MAX_RESULTS_PER_SEARCH: process.env.MAX_RESULTS_PER_SEARCH || undefined,
    ENRICHMENT_TTL_HOURS: process.env.ENRICHMENT_TTL_HOURS || undefined,
    WEBSITE_ANALYSIS_TTL_HOURS: process.env.WEBSITE_ANALYSIS_TTL_HOURS || undefined,
    MAX_EXPORT_ROWS: process.env.MAX_EXPORT_ROWS || undefined,
    AI_PROVIDER: process.env.AI_PROVIDER || undefined,
    GEMINI_API_KEY: env("GEMINI_API_KEY"),
    ANTHROPIC_API_KEY: env("ANTHROPIC_API_KEY"),
    AI_MODEL: env("AI_MODEL"),
    AI_EFFORT: process.env.AI_EFFORT || undefined,
    AI_MAX_OUTPUT_TOKENS: process.env.AI_MAX_OUTPUT_TOKENS || undefined,
    AI_ANALYSIS_TTL_HOURS: process.env.AI_ANALYSIS_TTL_HOURS || undefined,
    AI_CONCURRENCY: process.env.AI_CONCURRENCY || undefined,
    AI_TIMEOUT_MS: process.env.AI_TIMEOUT_MS || undefined,
    AI_TEMPERATURE: process.env.AI_TEMPERATURE || undefined,
    AI_THINKING_BUDGET: process.env.AI_THINKING_BUDGET || undefined,
    DB_POOL_MAX: process.env.DB_POOL_MAX || undefined,
    LEADS_MODULE_ENABLED: env("LEADS_MODULE_ENABLED")?.toLowerCase(),
    SESSION_MAX_AGE_DAYS: env("SESSION_MAX_AGE_DAYS"),
    STORAGE_DIR: env("STORAGE_DIR"),
    MAX_UPLOAD_MB: env("MAX_UPLOAD_MB"),
  });

  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Variáveis de ambiente inválidas: ${fields}. Consulte .env.example.`);
  }
  return parsed.data;
}

const env = readEnv();

export const serverConfig = {
  databaseUrl: env.DATABASE_URL ?? "",
  isDatabaseConfigured: Boolean(env.DATABASE_URL),

  /**
   * Conexões simultâneas por instância. Poolers (Supabase) e bancos pequenos
   * derrubam conexões quando uma única página abre consultas demais em
   * paralelo - o pool enfileira em vez de estourar o limite.
   */
  databasePoolMax: env.DB_POOL_MAX,

  auth: {
    /** Quanto tempo a sessão sobrevive sem uso. Ela se renova a cada visita. */
    sessionMaxAgeMs: env.SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
  },

  storage: {
    /** Pasta em disco onde ficam os arquivos enviados. Fora do versionamento. */
    dir: env.STORAGE_DIR,
    maxUploadBytes: env.MAX_UPLOAD_MB * 1024 * 1024,
    maxUploadMb: env.MAX_UPLOAD_MB,
  },

  /**
   * Captação automática de leads (OpenStreetMap, Receita Federal, IA).
   * Desligada enquanto não houver uma API adequada contratada: o código
   * continua inteiro, só as rotas e o menu ficam fora do ar.
   */
  leadsModuleEnabled: env.LEADS_MODULE_ENABLED,

  cnpj: {
    enabled: env.CNPJ_ENABLED,
    /** Onde o import guarda os arquivos baixados da Receita Federal. */
    dataDir: env.CNPJ_DATA_DIR,
  },

  openStreetMap: {
    enabled: env.OPENSTREETMAP_ENABLED,
    /** Instância principal primeiro; o fallback só entra em falha transitória. */
    overpassEndpoints: [env.OVERPASS_API_URL, env.OVERPASS_FALLBACK_URL].filter(
      (url, index, all): url is string => Boolean(url) && all.indexOf(url) === index,
    ),
    overpassTimeoutMs: env.OVERPASS_TIMEOUT_MS,
    overpassMaxAttempts: env.OVERPASS_MAX_ATTEMPTS,
    nominatimUrl: env.NOMINATIM_API_URL,
    nominatimMinIntervalMs: env.NOMINATIM_MIN_INTERVAL_MS,
  },

  crawler: {
    enabled: env.WEBSITE_CRAWLER_ENABLED,
    timeoutMs: env.WEBSITE_CRAWLER_TIMEOUT_MS,
    maxPages: env.WEBSITE_CRAWLER_MAX_PAGES,
    concurrency: env.WEBSITE_CRAWLER_CONCURRENCY,
    maxResponseBytes: env.WEBSITE_CRAWLER_MAX_RESPONSE_BYTES,
    maxSitesPerSearch: env.WEBSITE_CRAWLER_MAX_SITES_PER_SEARCH,
  },

  /** Uma pesquisa equivalente dentro deste prazo é respondida pelo banco. */
  searchCacheTtlMs: env.LEAD_CACHE_TTL_HOURS * 60 * 60 * 1000,

  /** Teto de estabelecimentos pedidos à fonte por pesquisa. */
  maxResultsPerSearch: env.MAX_RESULTS_PER_SEARCH,

  /** Um lead enriquecido há menos tempo que isto não volta ao provider. */
  enrichmentTtlMs: env.ENRICHMENT_TTL_HOURS * 60 * 60 * 1000,

  /** Um site analisado há menos tempo que isto não e baixado de novo. */
  websiteAnalysisTtlMs: env.WEBSITE_ANALYSIS_TTL_HOURS * 60 * 60 * 1000,

  /** Teto de linhas por exportação CSV. */
  maxExportRows: env.MAX_EXPORT_ROWS,

  /**
   * IA de ANÁLISE. Só classifica e explica leads que outra fonte já encontrou -
   * nunca inventa empresa, contato ou endereço.
   */
  ai: {
    provider: env.AI_PROVIDER,
    /** Chave do provider ativo. Fica só no servidor; nenhuma rota devolve isto. */
    apiKey:
      (env.AI_PROVIDER === "gemini" ? env.GEMINI_API_KEY : env.ANTHROPIC_API_KEY)?.trim() ?? "",
    model: env.AI_MODEL ?? DEFAULT_MODEL[env.AI_PROVIDER],
    /** Nível de esforço: menor = mais barato. Análise de lead e tarefa simples. */
    effort: env.AI_EFFORT,
    maxOutputTokens: env.AI_MAX_OUTPUT_TOKENS,
    /** Baixa de propósito: queremos classificação estável, não criatividade. */
    temperature: env.AI_TEMPERATURE,
    thinkingBudget: env.AI_THINKING_BUDGET,
    timeoutMs: env.AI_TIMEOUT_MS,
    /** Teto de análises simultâneas no lote. */
    concurrency: env.AI_CONCURRENCY,
    /** Análise mais nova que isto é reaproveitada sem chamar o modelo. */
    analysisTtlMs: env.AI_ANALYSIS_TTL_HOURS * 60 * 60 * 1000,
  },

  external: {
    concurrency: env.EXTERNAL_CONCURRENCY,
    timeoutMs: env.EXTERNAL_TIMEOUT_MS,
    retry: { retries: 2, baseDelayMs: 400 },
  },
} as const;

/** O provider de IA ativo tem tudo que precisa para rodar? */
export function isAiConfigured(): boolean {
  const { provider, apiKey, model } = serverConfig.ai;
  if (provider === "none") return false;
  if (provider === "mock") return true;
  return apiKey.length > 0 && model.length > 0;
}

/**
 * Retrato da configuração para a tela de Configurações.
 * Expõe apenas se cada chave existe - nunca o valor dela.
 */
export interface ConfigSummary {
  database: { configured: boolean; poolMax: number };
  leads: {
    sources: LeadSource[];
    configured: boolean;
    cnpjEnabled: boolean;
    cnpjDataDir: string;
    maxResultsPerSearch: number;
    overpassEndpoints: readonly string[];
    overpassTimeoutMs: number;
    overpassMaxAttempts: number;
    nominatimUrl: string;
    nominatimMinIntervalMs: number;
  };
  crawler: {
    enabled: boolean;
    timeoutMs: number;
    maxPages: number;
    concurrency: number;
    maxResponseBytes: number;
    maxSitesPerSearch: number;
  };
  ai: {
    provider: AiProviderName;
    configured: boolean;
    model: string;
    effort: AiEffort;
    concurrency: number;
    analysisTtlHours: number;
    maxOutputTokens: number;
  };
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
      sources: [
        ...(serverConfig.openStreetMap.enabled ? (["openstreetmap"] as const) : []),
        ...(serverConfig.cnpj.enabled ? (["receita_federal"] as const) : []),
      ],
      // Nenhuma fonte usa chave: basta uma estar habilitada.
      configured: serverConfig.openStreetMap.enabled || serverConfig.cnpj.enabled,
      cnpjEnabled: serverConfig.cnpj.enabled,
      cnpjDataDir: serverConfig.cnpj.dataDir,
      maxResultsPerSearch: serverConfig.maxResultsPerSearch,
      overpassEndpoints: serverConfig.openStreetMap.overpassEndpoints,
      overpassTimeoutMs: serverConfig.openStreetMap.overpassTimeoutMs,
      overpassMaxAttempts: serverConfig.openStreetMap.overpassMaxAttempts,
      nominatimUrl: serverConfig.openStreetMap.nominatimUrl,
      nominatimMinIntervalMs: serverConfig.openStreetMap.nominatimMinIntervalMs,
    },
    crawler: { ...serverConfig.crawler },
    ai: {
      provider: serverConfig.ai.provider,
      // Só diz se a chave existe - o valor nunca sai do servidor.
      configured: isAiConfigured(),
      model: serverConfig.ai.model,
      effort: serverConfig.ai.effort,
      concurrency: serverConfig.ai.concurrency,
      analysisTtlHours: hours(serverConfig.ai.analysisTtlMs),
      maxOutputTokens: serverConfig.ai.maxOutputTokens,
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
