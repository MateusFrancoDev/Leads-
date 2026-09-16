/**
 * Orquestra a busca de leads. Esta e a regra mais importante do custo:
 *
 *   entrada -> normaliza -> procura no cache do banco -> (so entao) provider
 *           -> normaliza resultados -> deduplica -> persiste -> score -> grava a pesquisa
 *
 * Nenhuma outra camada pode chamar um provider diretamente.
 */

import { mapWithConcurrency } from "@/lib/http";
import { createLogger } from "@/lib/logger";
import { cleanupText, normalizeCity, normalizeState } from "@/lib/normalize";
import type { SearchFormInput } from "@/lib/validation";
import { serverConfig } from "@/server/config";
import { getActiveProvider } from "@/server/providers";
import { upsertLead } from "@/server/repositories/lead-repository";
import {
  buildSearchCacheKey,
  findFreshSearch,
  recordApiUsage,
  registerCacheHit,
  saveSearch,
} from "@/server/repositories/search-repository";
import { dedupeLeadInputs, toLeadUpsertInput } from "@/server/services/lead-normalizer";
import type { NormalizedSearch, SearchExecution } from "@/types/search";

const logger = createLogger("lead-search");

/** Padroniza cidade/UF para que "osasco" e "Osasco/SP" caiam na mesma chave. */
export function normalizeSearchInput(input: SearchFormInput): NormalizedSearch {
  return {
    term: cleanupText(input.term) ?? input.term,
    keyword: cleanupText(input.keyword ?? null),
    city: normalizeCity(input.city ?? null),
    state: normalizeState(input.state ?? null),
    neighborhood: normalizeCity(input.neighborhood ?? null),
    country: "BR",
    radiusMeters: input.radiusKm ? Math.round(input.radiusKm * 1000) : null,
    latitude: null,
    longitude: null,
  };
}

export async function executeSearch(input: SearchFormInput): Promise<SearchExecution> {
  const search = normalizeSearchInput(input);
  const provider = getActiveProvider();
  const cacheKey = buildSearchCacheKey(provider.name, search);

  const cached = await findFreshSearch(cacheKey);
  if (cached) {
    await registerCacheHit(cached.id);
    logger.info("cache hit", { cacheKey, leads: cached.resultsCount });
    return {
      searchId: cached.id,
      source: "cache",
      total: cached.resultsCount,
      newLeads: 0,
      providerRequests: 0,
    };
  }

  const term = [search.term, search.keyword].filter(Boolean).join(" ");
  let providerRequests = 0;

  try {
    const response = await provider.searchBusinesses({
      term,
      city: search.city,
      state: search.state,
      neighborhood: search.neighborhood,
      country: search.country,
      latitude: search.latitude,
      longitude: search.longitude,
      radiusMeters: search.radiusMeters,
      limit: serverConfig.maxResultsPerSearch,
    });
    providerRequests = response.requests;

    const inputs = dedupeLeadInputs(
      response.data.map((business) => toLeadUpsertInput(provider.name, business)),
    );

    // Gravacao com concorrencia limitada: a ordem dos ids e preservada.
    const saved = await mapWithConcurrency(inputs, serverConfig.external.concurrency, (lead) =>
      upsertLead(lead),
    );

    const searchId = await saveSearch({
      cacheKey,
      provider: provider.name,
      search,
      leadIds: saved.map((lead) => lead.id),
      requests: providerRequests,
      ttlMs: serverConfig.searchCacheTtlMs,
    });

    await recordApiUsage({
      provider: provider.name,
      operation: "searchBusinesses",
      requests: providerRequests,
      items: saved.length,
      success: true,
    });

    const newLeads = saved.filter((lead) => lead.isNew).length;
    logger.info("busca persistida", { leads: saved.length, novos: newLeads, providerRequests });

    return { searchId, source: "provider", total: saved.length, newLeads, providerRequests };
  } catch (error) {
    await recordApiUsage({
      provider: provider.name,
      operation: "searchBusinesses",
      requests: providerRequests,
      items: 0,
      success: false,
    });
    throw error;
  }
}
