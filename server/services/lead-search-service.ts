/**
 * Busca de leads reais: liga o pipeline (lib/leads/search-pipeline) à
 * configuração, ao banco e ao crawler. Nenhuma outra camada chama a fonte de
 * empresas diretamente.
 *
 *   entrada validada -> cache (banco) -> OpenStreetMap -> deduplicação
 *                    -> crawler dos sites oficiais -> Lead Score -> banco
 */

import { createLogger } from "@/lib/logger";
import { crawlWebsite, type WebsiteCrawlResult } from "@/lib/leads/enrichment/website-crawler";
import type { PublicLead } from "@/lib/leads/public-lead";
import {
  LeadSearchPipeline,
  type LeadSearchOutcome,
  type LeadSearchRequest,
  type LeadSearchRunOptions,
  type LeadSearchSummary,
} from "@/lib/leads/search-pipeline";
import { OSM_USER_AGENT, serverConfig } from "@/server/config";
import { getActiveProvider } from "@/server/providers";
import { findExistingLeadsForBatch, findSearchLeadsForApi, saveSearchLeads } from "@/server/repositories/lead-repository";
import {
  findSearchByCacheKey,
  recordApiUsage,
  registerCacheHit,
  saveSearch,
} from "@/server/repositories/search-repository";

const logger = createLogger("Lead Search");

/** Lê o site oficial com as proteções e limites do .env. */
export function crawlLeadWebsite(url: string): Promise<WebsiteCrawlResult> {
  return crawlWebsite(url, {
    maxPages: serverConfig.crawler.maxPages,
    timeoutMs: serverConfig.crawler.timeoutMs,
    maxBytes: serverConfig.crawler.maxResponseBytes,
    userAgent: OSM_USER_AGENT,
  });
}

/** Resumo no formato pedido para desenvolvimento. Nunca inclui URLs de banco ou segredos. */
function logSummary(summary: LeadSearchSummary): void {
  logger.info(
    [
      "",
      `Query: ${summary.query}`,
      `Location: ${summary.location}`,
      `Origem: ${summary.source}`,
      "",
      `Cache: ${summary.cachedResults}`,
      `OSM encontrados: ${summary.openStreetMapResults}`,
      `Duplicados: ${summary.duplicatesRemoved}`,
      `Crawler enriquecidos: ${summary.crawlerEnriched}`,
      "",
      `Final: ${summary.total} leads reais`,
    ].join("\n"),
  );
}

let pipeline: LeadSearchPipeline<PublicLead> | null = null;

function getPipeline(): LeadSearchPipeline<PublicLead> {
  if (pipeline) return pipeline;

  const provider = getActiveProvider();
  pipeline = new LeadSearchPipeline<PublicLead>({
    provider,
    enrichmentTtlMs: serverConfig.enrichmentTtlMs,
    maxFetchLimit: serverConfig.maxResultsPerSearch,
    crawler: {
      enabled: serverConfig.crawler.enabled,
      concurrency: serverConfig.crawler.concurrency,
      maxSitesPerSearch: serverConfig.crawler.maxSitesPerSearch,
      crawl: crawlLeadWebsite,
    },
    store: {
      findSearch: findSearchByCacheKey,
      registerCacheHit,
      findExistingLeads: findExistingLeadsForBatch,
      saveLeads: saveSearchLeads,
      saveSearch: (record) => saveSearch(record, serverConfig.searchCacheTtlMs),
      readSearchLeads: findSearchLeadsForApi,
      recordUsage: (usage) => recordApiUsage({ provider: provider.name, ...usage }),
    },
    log: logSummary,
    onBackgroundError: () => logger.warn("falha ao atualizar o cache em segundo plano"),
  });
  return pipeline;
}

export function searchLeads(
  request: LeadSearchRequest,
  options: LeadSearchRunOptions = {},
): Promise<LeadSearchOutcome<PublicLead>> {
  return getPipeline().search(request, options);
}
