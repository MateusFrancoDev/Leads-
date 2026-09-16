/**
 * Fluxo completo de uma busca de leads, sem depender de Prisma nem de Next:
 *
 *   cache -> fontes (OSM + Receita Federal) -> deduplicação no lote e contra o banco
 *         -> crawler dos sites -> Lead Score -> persistência -> leitura filtrada
 *
 * O banco e o crawler entram por injeção (LeadSearchStore, crawler), o que
 * permite testar cache, deduplicação e enriquecimento sem rede nem banco.
 */

import type { WebsiteStatus } from "@/generated/prisma/enums";
import { mapWithConcurrency } from "@/lib/http";
import { mapCategory } from "@/lib/leads/category-mapper";
import { dedupeLeadResults, findDuplicateLead, mergeLeadResults } from "@/lib/leads/deduplication";
import { applyWebsiteCrawl, type WebsiteCrawlResult } from "@/lib/leads/enrichment/website-crawler";
import { calculateLeadScore, type LeadScoreResult } from "@/lib/leads/lead-score";
import { toDbWebsiteStatus, toDbWhatsappStatus } from "@/lib/leads/status";
import type { LeadProvider, LeadResult, LeadSearchFilters, LeadSource } from "@/lib/leads/types";
import { slugify } from "@/lib/normalize";

export interface LeadSearchRequest {
  query: string;
  city: string;
  state: string;
  /** Cidades vizinhas da mesma UF. */
  extraCities: readonly string[];
  limit: number;
  filters: LeadSearchFilters;
}

export type SourceCounts = Partial<Record<LeadSource, number>>;

export interface SearchCacheEntry {
  id: string;
  fetchLimit: number | null;
  rawCount: number;
  expiresAt: Date;
  sourceCounts: SourceCounts;
  warnings: readonly string[];
}

/**
 * Lead já gravado, no formato de resultado, com o que o banco sabe a mais.
 * Pode ter vindo de outra fonte (legado), por isso source/externalId são livres.
 */
export interface ExistingLead extends Omit<LeadResult, "source" | "externalId"> {
  id: string;
  source: string;
  externalId: string | null;
  dbWebsiteStatus: WebsiteStatus;
  enrichedAt: Date | null;
  websiteHasHttps: boolean | null;
}

export interface PreparedLead {
  lead: LeadResult;
  existingId: string | null;
  dbWebsiteStatus: WebsiteStatus;
  score: LeadScoreResult;
  /** true quando o crawler leu o site nesta busca. */
  enrichedNow: boolean;
}

export interface SaveSearchRecord {
  cacheKey: string;
  source: string;
  query: string;
  city: string;
  state: string;
  extraCities: readonly string[];
  fetchLimit: number;
  rawCount: number;
  leadIds: readonly string[];
  requests: number;
  sourceCounts: SourceCounts;
  warnings: readonly string[];
}

export interface LeadSearchStore<TLead> {
  findSearch(cacheKey: string): Promise<SearchCacheEntry | null>;
  registerCacheHit(searchId: string): Promise<void>;
  findExistingLeads(leads: readonly LeadResult[]): Promise<ExistingLead[]>;
  /** Grava na ordem recebida e devolve os ids na mesma ordem. */
  saveLeads(leads: readonly PreparedLead[]): Promise<string[]>;
  saveSearch(record: SaveSearchRecord): Promise<string>;
  readSearchLeads(searchId: string, filters: LeadSearchFilters, limit: number): Promise<TLead[]>;
  recordUsage(usage: { operation: string; requests: number; items: number; success: boolean }): Promise<void>;
}

export interface LeadSearchCrawler {
  enabled: boolean;
  concurrency: number;
  /** Teto de sites lidos por busca, para uma pesquisa grande não virar uma varredura. */
  maxSitesPerSearch: number;
  crawl(url: string): Promise<WebsiteCrawlResult>;
}

export interface LeadSearchSummary {
  query: string;
  location: string;
  source: LeadSearchSource;
  cachedResults: number;
  openStreetMapResults: number;
  receitaFederalResults: number;
  duplicatesRemoved: number;
  crawlerEnriched: number;
  total: number;
  warnings: readonly string[];
}

export interface LeadSearchPipelineDeps<TLead> {
  provider: LeadProvider;
  store: LeadSearchStore<TLead>;
  crawler: LeadSearchCrawler;
  enrichmentTtlMs: number;
  maxFetchLimit: number;
  now?: () => Date;
  log?: (summary: LeadSearchSummary) => void;
  onBackgroundError?: (error: unknown) => void;
}

export type LeadSearchSource = "cache" | "stale-cache" | "provider";

export interface LeadSearchMetadata {
  total: number;
  openStreetMapResults: number;
  receitaFederalResults: number;
  duplicatesRemoved: number;
  crawlerEnriched: number;
  cachedResults: number;
  /** Requisições externas feitas nesta execução (0 quando veio do cache). */
  externalRequests: number;
  /** Avisos das fontes (fonte fora do ar, cidade não importada...). */
  warnings: string[];
}

export interface LeadSearchOutcome<TLead> {
  searchId: string;
  source: LeadSearchSource;
  leads: TLead[];
  metadata: LeadSearchMetadata;
}

export interface LeadSearchRunOptions {
  /**
   * Agenda trabalho para depois da resposta (no Next, `after`). Quando
   * existe, um cache vencido é devolvido na hora e atualizado em segundo plano.
   */
  scheduleBackground?: (task: () => Promise<void>) => void;
}

/** Chave estável: "barbearia", "Barbearias" e "barber shop" dividem o mesmo cache. */
export function buildLeadSearchCacheKey(
  source: string,
  request: Pick<LeadSearchRequest, "query" | "city" | "state" | "extraCities">,
): string {
  const rule = mapCategory(request.query);
  const segment = rule ? rule.id : `nome:${slugify(request.query)}`;
  const cities = [...new Set(request.extraCities.map((city) => slugify(city)))].sort().join(",");
  return [source, segment, slugify(request.city), request.state.toLowerCase(), cities].filter(Boolean).join("|");
}

/** Cidades vizinhas sem repetição e sem a cidade principal. */
export function normalizeExtraCities(city: string, extraCities: readonly string[]): string[] {
  const main = slugify(city);
  const seen = new Set<string>([main]);
  const result: string[] = [];
  for (const raw of extraCities) {
    const name = raw.replace(/\s+/g, " ").trim();
    const key = slugify(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }
  return result;
}

export function hasActiveFilters(filters: LeadSearchFilters): boolean {
  return Object.values(filters).some((value) => value !== undefined);
}

/**
 * Quantos elementos pedir à fonte. Pede uma folga sobre a quantidade para
 * compensar duplicados; com filtros, uma folga maior, porque parte dos
 * resultados será descartada por eles.
 */
export function computeFetchLimit(limit: number, filtered: boolean, maxFetchLimit: number): number {
  const wanted = filtered ? limit * 4 : Math.max(limit * 2, limit + 20);
  return Math.max(1, Math.min(maxFetchLimit, Math.max(limit, wanted)));
}

/**
 * O cache atende quando já pediu pelo menos o mesmo volume à fonte - ou quando
 * a fonte devolveu menos do que o pedido, sinal de que não existe mais nada.
 */
export function isCacheSufficient(entry: SearchCacheEntry, fetchLimit: number): boolean {
  const previousLimit = entry.fetchLimit ?? 0;
  return previousLimit >= fetchLimit || entry.rawCount < previousLimit;
}

function isEnrichmentFresh(existing: ExistingLead, website: string | null, now: Date, ttlMs: number): boolean {
  return (
    existing.enrichedAt !== null &&
    existing.website === website &&
    (existing.enrichmentStatus === "completed" || existing.enrichmentStatus === "partial") &&
    now.getTime() - existing.enrichedAt.getTime() < ttlMs
  );
}

/** Campos vazios do resultado novo recebem o que o banco já sabia (com a origem). */
function fillFromExisting(fresh: LeadResult, existing: ExistingLead): LeadResult {
  const merged = mergeLeadResults(fresh, { ...existing, source: fresh.source, externalId: fresh.externalId });
  return { ...merged, rawData: fresh.rawData };
}

const CONTACT_FIELDS = ["phone", "email", "instagram", "facebook", "linkedin", "whatsapp"] as const;

function gainedContact(before: LeadResult, after: LeadResult): boolean {
  return (
    CONTACT_FIELDS.some((field) => !before[field] && Boolean(after[field])) ||
    (before.whatsappStatus !== "confirmed" && after.whatsappStatus === "confirmed")
  );
}

interface Draft {
  lead: LeadResult;
  existing: ExistingLead | null;
  enrichedNow: boolean;
}

interface ProviderRun {
  searchId: string;
  metadata: Omit<LeadSearchMetadata, "total">;
}

export class LeadSearchPipeline<TLead> {
  private readonly deps: LeadSearchPipelineDeps<TLead>;
  private readonly inFlight = new Map<string, Promise<ProviderRun>>();

  constructor(deps: LeadSearchPipelineDeps<TLead>) {
    this.deps = deps;
  }

  private now(): Date {
    return this.deps.now?.() ?? new Date();
  }

  async search(request: LeadSearchRequest, options: LeadSearchRunOptions = {}): Promise<LeadSearchOutcome<TLead>> {
    const { store, provider } = this.deps;
    request = { ...request, extraCities: normalizeExtraCities(request.city, request.extraCities) };
    const cacheKey = buildLeadSearchCacheKey(provider.name, request);
    const fetchLimit = computeFetchLimit(request.limit, hasActiveFilters(request.filters), this.deps.maxFetchLimit);
    const location = [request.city, ...request.extraCities].join(", ") + `/${request.state}`;

    const cached = await store.findSearch(cacheKey);
    if (cached && isCacheSufficient(cached, fetchLimit)) {
      const fresh = cached.expiresAt.getTime() > this.now().getTime();
      if (fresh || options.scheduleBackground) {
        await store.registerCacheHit(cached.id);
        if (!fresh && options.scheduleBackground) {
          options.scheduleBackground(async () => {
            try {
              await this.runProviderSearch(cacheKey, request, fetchLimit);
            } catch (error) {
              this.deps.onBackgroundError?.(error);
            }
          });
        }

        const leads = await store.readSearchLeads(cached.id, request.filters, request.limit);
        const source: LeadSearchSource = fresh ? "cache" : "stale-cache";
        const metadata: LeadSearchMetadata = {
          total: leads.length,
          openStreetMapResults: 0,
          receitaFederalResults: 0,
          duplicatesRemoved: 0,
          crawlerEnriched: 0,
          cachedResults: leads.length,
          externalRequests: 0,
          warnings: [...cached.warnings],
        };
        this.deps.log?.({ query: request.query, location, source, ...metadata });
        return { searchId: cached.id, source, leads, metadata };
      }
    }

    const run = await this.runProviderSearch(cacheKey, request, fetchLimit);
    const leads = await store.readSearchLeads(run.searchId, request.filters, request.limit);
    const metadata: LeadSearchMetadata = { ...run.metadata, total: leads.length };
    this.deps.log?.({ query: request.query, location, source: "provider", ...metadata });
    return { searchId: run.searchId, source: "provider", leads, metadata };
  }

  /** Buscas idênticas simultâneas compartilham a mesma consulta à fonte. */
  private runProviderSearch(cacheKey: string, request: LeadSearchRequest, fetchLimit: number): Promise<ProviderRun> {
    const pending = this.inFlight.get(cacheKey);
    if (pending) return pending;
    const run = this.executeProviderSearch(cacheKey, request, fetchLimit).finally(() => this.inFlight.delete(cacheKey));
    this.inFlight.set(cacheKey, run);
    return run;
  }

  private async executeProviderSearch(
    cacheKey: string,
    request: LeadSearchRequest,
    fetchLimit: number,
  ): Promise<ProviderRun> {
    const { provider, store, crawler } = this.deps;
    let requests = 0;

    try {
      const response = await provider.search({
        query: request.query,
        city: request.city,
        state: request.state,
        extraCities: request.extraCities,
        limit: fetchLimit,
      });
      requests = response.requests;

      const batch = dedupeLeadResults(response.leads);
      let duplicatesRemoved = batch.duplicatesRemoved;

      // Deduplicação contra o banco: o mesmo lugar pode já existir com outro id.
      const existingLeads = await store.findExistingLeads(batch.leads);
      const drafts: Draft[] = [];
      const draftByExistingId = new Map<string, Draft>();
      for (const lead of batch.leads) {
        const existing = findDuplicateLead(lead, existingLeads)?.match ?? null;
        const sameRecord = existing ? draftByExistingId.get(existing.id) : undefined;
        if (sameRecord) {
          sameRecord.lead = mergeLeadResults(sameRecord.lead, lead);
          duplicatesRemoved += 1;
          continue;
        }
        const draft: Draft = { lead, existing, enrichedNow: false };
        drafts.push(draft);
        if (existing) draftByExistingId.set(existing.id, draft);
      }

      // Cache de enriquecimento: site lido há pouco não é baixado de novo.
      const now = this.now();
      let cachedResults = 0;
      const toCrawl: Draft[] = [];
      for (const draft of drafts) {
        if (draft.existing) cachedResults += 1;
        if (!draft.lead.website) continue;
        if (draft.existing && isEnrichmentFresh(draft.existing, draft.lead.website, now, this.deps.enrichmentTtlMs)) {
          draft.lead = { ...draft.lead, enrichmentStatus: draft.existing.enrichmentStatus };
          continue;
        }
        if (crawler.enabled && toCrawl.length < crawler.maxSitesPerSearch) toCrawl.push(draft);
      }

      let crawlerEnriched = 0;
      await mapWithConcurrency(toCrawl, crawler.concurrency, async (draft) => {
        const website = draft.lead.website;
        if (!website) return;
        try {
          const result = await crawler.crawl(website);
          const enriched = applyWebsiteCrawl(draft.lead, result);
          if (gainedContact(draft.lead, enriched)) crawlerEnriched += 1;
          draft.lead = enriched;
        } catch {
          // Falha no site nunca descarta a empresa.
          draft.lead = { ...draft.lead, enrichmentStatus: "failed" };
        }
        draft.enrichedNow = true;
      });

      const prepared: PreparedLead[] = drafts.map((draft) => {
        const lead = draft.existing ? fillFromExisting(draft.lead, draft.existing) : draft.lead;
        const existing = draft.existing;
        // Site que a análise marcou como fora do ar continua assim até ser reanalisado.
        const dbWebsiteStatus =
          existing?.dbWebsiteStatus === "UNREACHABLE_WEBSITE" && existing.website === lead.website
            ? existing.dbWebsiteStatus
            : toDbWebsiteStatus(lead.websiteStatus);
        const score = calculateLeadScore({
          websiteStatus: dbWebsiteStatus,
          whatsappStatus: toDbWhatsappStatus(lead.whatsappStatus),
          phone: lead.phone,
          email: lead.email,
          instagram: lead.instagram,
          facebook: lead.facebook,
          street: lead.street,
          number: lead.number,
          city: lead.city,
          websiteHasHttps: existing && existing.website === lead.website ? existing.websiteHasHttps : null,
        });
        return {
          lead: { ...lead, score: score.score },
          existingId: existing?.id ?? null,
          dbWebsiteStatus,
          score,
          enrichedNow: draft.enrichedNow,
        };
      });

      const leadIds = await store.saveLeads(prepared);
      const searchId = await store.saveSearch({
        cacheKey,
        source: provider.name,
        query: request.query,
        city: request.city,
        state: request.state,
        extraCities: request.extraCities,
        fetchLimit,
        rawCount: response.rawCount,
        leadIds,
        requests,
        sourceCounts: response.sourceCounts,
        warnings: response.warnings,
      });
      await store.recordUsage({ operation: "search", requests, items: leadIds.length, success: true });

      return {
        searchId,
        metadata: {
          openStreetMapResults: response.sourceCounts.openstreetmap ?? 0,
          receitaFederalResults: response.sourceCounts.receita_federal ?? 0,
          duplicatesRemoved,
          crawlerEnriched,
          cachedResults,
          externalRequests: requests,
          warnings: response.warnings,
        },
      };
    } catch (error) {
      await store.recordUsage({ operation: "search", requests, items: 0, success: false });
      throw error;
    }
  }
}
