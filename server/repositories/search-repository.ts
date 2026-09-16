/**
 * Acesso a dados de Search / SearchResult / ApiUsage.
 *
 * A tabela Search e o cache: a mesma pesquisa repetida dentro do TTL e
 * respondida pelo banco, sem gastar requisicao do provider.
 */

import type { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/errors";
import { slugify } from "@/lib/normalize";
import { prisma } from "@/server/db/prisma";
import type { NormalizedSearch, SearchHistoryItem } from "@/types/search";

/** Chave estavel da pesquisa (ex.: "google_places|dentista|osasco|sp|5000"). */
export function buildSearchCacheKey(provider: string, search: NormalizedSearch): string {
  return [
    provider,
    slugify(search.term),
    slugify(search.keyword ?? ""),
    slugify(search.neighborhood ?? ""),
    slugify(search.city ?? ""),
    slugify(search.state ?? ""),
    search.radiusMeters ?? "",
  ].join("|");
}

/** Campos usados pelo historico e pelo resumo da pesquisa. */
const SEARCH_SELECT = {
  id: true,
  term: true,
  keyword: true,
  city: true,
  state: true,
  neighborhood: true,
  radiusMeters: true,
  provider: true,
  resultsCount: true,
  requestCount: true,
  runCount: true,
  cacheHits: true,
  lastRunAt: true,
  expiresAt: true,
} satisfies Prisma.SearchSelect;

export interface CachedSearch {
  id: string;
  resultsCount: number;
  lastRunAt: Date;
}

/** Pesquisa ainda dentro da validade. null significa "precisa consultar a API". */
export async function findFreshSearch(cacheKey: string): Promise<CachedSearch | null> {
  try {
    return await prisma.search.findFirst({
      where: { cacheKey, expiresAt: { gt: new Date() } },
      select: { id: true, resultsCount: true, lastRunAt: true },
    });
  } catch (error) {
    throw new AppError("DATABASE_ERROR", undefined, error);
  }
}

/** Registra que uma pesquisa foi respondida pelo cache (metrica de economia). */
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

export interface SaveSearchInput {
  cacheKey: string;
  provider: string;
  search: NormalizedSearch;
  leadIds: readonly string[];
  requests: number;
  ttlMs: number;
}

/** Grava a pesquisa e o vinculo com os leads encontrados, preservando a ordem. */
export async function saveSearch({
  cacheKey,
  provider,
  search,
  leadIds,
  requests,
  ttlMs,
}: SaveSearchInput): Promise<string> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);

  try {
    const record = await prisma.search.upsert({
      where: { cacheKey },
      create: {
        cacheKey,
        provider,
        term: search.term,
        keyword: search.keyword,
        city: search.city,
        state: search.state,
        neighborhood: search.neighborhood,
        country: search.country,
        radiusMeters: search.radiusMeters,
        latitude: search.latitude,
        longitude: search.longitude,
        resultsCount: leadIds.length,
        requestCount: requests,
        expiresAt,
      },
      update: {
        resultsCount: leadIds.length,
        requestCount: { increment: requests },
        runCount: { increment: 1 },
        lastRunAt: now,
        expiresAt,
      },
      select: { id: true },
    });

    await prisma.$transaction([
      prisma.searchResult.deleteMany({ where: { searchId: record.id } }),
      prisma.searchResult.createMany({
        data: leadIds.map((leadId, position) => ({ searchId: record.id, leadId, position })),
        skipDuplicates: true,
      }),
    ]);

    return record.id;
  } catch (error) {
    throw new AppError("DATABASE_ERROR", undefined, error);
  }
}

type SearchRow = Omit<SearchHistoryItem, "isCacheFresh">;

function withFreshness(row: SearchRow, now: number): SearchHistoryItem {
  return { ...row, isCacheFresh: row.expiresAt.getTime() > now };
}

/** Dados da pesquisa usados para preencher o formulario e resumir o resultado. */
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
  /** Custo estimado, quando conhecido (hoje so as chamadas de IA tem preco). */
  costUsd?: number | null;
}

/**
 * Registro simples de consumo de API. Falhar aqui nunca pode derrubar a
 * operacao principal - metrica e efeito colateral.
 */
export async function recordApiUsage(input: ApiUsageInput): Promise<void> {
  try {
    await prisma.apiUsage.create({ data: input });
  } catch {
    // Silencioso de proposito: metrica nao interrompe a busca do usuario.
  }
}

/** Metricas de consumo: mostram quanto o cache esta economizando. */
export interface UsageStats {
  searches: number;
  runs: number;
  cacheHits: number;
  providerRequests: number;
  analyzedWebsites: number;
  aiAnalyses: number;
  /** Custo acumulado estimado das chamadas com preco conhecido (hoje, a IA). */
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
