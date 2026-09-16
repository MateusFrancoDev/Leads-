/**
 * Acesso a dados de Search / SearchResult / ApiUsage.
 *
 * A tabela Search e o cache: uma pesquisa equivalente dentro do TTL é
 * respondida pelo banco, sem nenhuma consulta ao OpenStreetMap.
 */

import type { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/errors";
import type { SaveSearchRecord, SearchCacheEntry, SourceCounts } from "@/lib/leads/search-pipeline";
import { LEAD_SOURCES } from "@/lib/leads/types";
import { prisma } from "@/server/db/prisma";
import type { SearchHistoryItem } from "@/types/search";

/** Campos usados pelo histórico e pelo resumo da pesquisa. */
const SEARCH_SELECT = {
  id: true,
  term: true,
  city: true,
  state: true,
  extraCities: true,
  provider: true,
  sourceCounts: true,
  warnings: true,
  resultsCount: true,
  requestCount: true,
  runCount: true,
  cacheHits: true,
  lastRunAt: true,
  expiresAt: true,
} satisfies Prisma.SearchSelect;

/** Contagem por fonte gravada como JSON: só números de fontes conhecidas passam. */
export function parseSourceCounts(value: unknown): SourceCounts {
  const counts: SourceCounts = {};
  if (!value || typeof value !== "object") return counts;
  for (const source of LEAD_SOURCES) {
    const count = (value as Record<string, unknown>)[source];
    if (typeof count === "number" && Number.isFinite(count)) counts[source] = count;
  }
  return counts;
}

/** Pesquisa gravada com esta chave, vencida ou não - o serviço decide o que fazer. */
export async function findSearchByCacheKey(cacheKey: string): Promise<SearchCacheEntry | null> {
  try {
    const row = await prisma.search.findUnique({
      where: { cacheKey },
      select: { id: true, fetchLimit: true, rawCount: true, expiresAt: true, sourceCounts: true, warnings: true },
    });
    return row ? { ...row, sourceCounts: parseSourceCounts(row.sourceCounts) } : null;
  } catch (error) {
    throw new AppError("DATABASE_ERROR", undefined, error);
  }
}

/** Registra que uma pesquisa foi respondida pelo cache (métrica de economia). */
export async function registerCacheHit(searchId: string): Promise<void> {
  try {
    await prisma.search.update({
      where: { id: searchId },
      data: { cacheHits: { increment: 1 }, runCount: { increment: 1 }, lastRunAt: new Date() },
    });
  } catch (error) {
    throw new AppError("DATABASE_ERROR", undefined, error);
  }
}

/** Grava a pesquisa e o vinculo com os leads encontrados, preservando a ordem. */
export async function saveSearch(record: SaveSearchRecord, ttlMs: number): Promise<string> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);

  try {
    const saved = await prisma.search.upsert({
      where: { cacheKey: record.cacheKey },
      create: {
        cacheKey: record.cacheKey,
        provider: record.source,
        term: record.query,
        city: record.city,
        state: record.state,
        extraCities: [...record.extraCities],
        sourceCounts: record.sourceCounts,
        warnings: [...record.warnings],
        country: "BR",
        resultsCount: record.leadIds.length,
        requestCount: record.requests,
        fetchLimit: record.fetchLimit,
        rawCount: record.rawCount,
        expiresAt,
      },
      update: {
        term: record.query,
        extraCities: [...record.extraCities],
        sourceCounts: record.sourceCounts,
        warnings: [...record.warnings],
        resultsCount: record.leadIds.length,
        requestCount: { increment: record.requests },
        fetchLimit: record.fetchLimit,
        rawCount: record.rawCount,
        runCount: { increment: 1 },
        lastRunAt: now,
        expiresAt,
      },
      select: { id: true },
    });

    await prisma.$transaction([
      prisma.searchResult.deleteMany({ where: { searchId: saved.id } }),
      prisma.searchResult.createMany({
        data: record.leadIds.map((leadId, position) => ({ searchId: saved.id, leadId, position })),
        skipDuplicates: true,
      }),
    ]);

    return saved.id;
  } catch (error) {
    throw new AppError("DATABASE_ERROR", undefined, error);
  }
}

type SearchRow = Omit<SearchHistoryItem, "isCacheFresh" | "sourceCounts"> & { sourceCounts: unknown };

function withFreshness(row: SearchRow, now: number): SearchHistoryItem {
  return { ...row, sourceCounts: parseSourceCounts(row.sourceCounts), isCacheFresh: row.expiresAt.getTime() > now };
}

/** Dados da pesquisa usados para preencher o formulário e resumir o resultado. */
export async function findSearchById(id: string): Promise<SearchHistoryItem | null> {
  try {
    const row = await prisma.search.findUnique({ where: { id }, select: SEARCH_SELECT });
    return row ? withFreshness(row, Date.now()) : null;
  } catch (error) {
    throw new AppError("DATABASE_ERROR", undefined, error);
  }
}

export async function listRecentSearches(take: number): Promise<SearchHistoryItem[]> {
  try {
    const rows = await prisma.search.findMany({
      orderBy: { lastRunAt: "desc" },
      take,
      select: SEARCH_SELECT,
    });
    const now = Date.now();
    return rows.map((row) => withFreshness(row, now));
  } catch (error) {
    throw new AppError("DATABASE_ERROR", undefined, error);
  }
}

export interface ApiUsageInput {
  provider: string;
  operation: string;
  requests: number;
  items: number;
  success: boolean;
  /** Custo estimado, quando conhecido (só as chamadas de IA tem preço). */
  costUsd?: number | null;
}

/**
 * Registro simples de consumo de API. Falhar aqui nunca pode derrubar a
 * operação principal - métrica e efeito colateral.
 */
export async function recordApiUsage(input: ApiUsageInput): Promise<void> {
  try {
    await prisma.apiUsage.create({ data: input });
  } catch {
    // Silencioso de propósito: métrica não interrompe a busca do usuário.
  }
}

/** Métricas de consumo: mostram quanto o cache esta economizando. */
export interface UsageStats {
  searches: number;
  runs: number;
  cacheHits: number;
  providerRequests: number;
  analyzedWebsites: number;
  aiAnalyses: number;
  /** Custo acumulado estimado das chamadas com preço conhecido (hoje, a IA). */
  aiCostUsd: number;
}

export async function getUsageStats(): Promise<UsageStats> {
  try {
    const [searches, analyzedWebsites, aiAnalyses, aiCost] = await Promise.all([
      prisma.search.aggregate({
        _count: { _all: true },
        _sum: { runCount: true, cacheHits: true, requestCount: true },
      }),
      prisma.leadWebsiteAnalysis.count(),
      prisma.leadAiAnalysis.count(),
      prisma.apiUsage.aggregate({
        where: { operation: "analyzeOpportunity", success: true },
        _sum: { costUsd: true },
      }),
    ]);

    return {
      searches: searches._count._all,
      runs: searches._sum.runCount ?? 0,
      cacheHits: searches._sum.cacheHits ?? 0,
      providerRequests: searches._sum.requestCount ?? 0,
      analyzedWebsites,
      aiAnalyses,
      aiCostUsd: aiCost._sum.costUsd ?? 0,
    };
  } catch (error) {
    throw new AppError("DATABASE_ERROR", undefined, error);
  }
}
