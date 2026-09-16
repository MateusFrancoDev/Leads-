import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { AppError } from "@/lib/errors";
import type { WebsiteCrawlResult } from "@/lib/leads/enrichment/website-crawler";
import {
  buildLeadSearchCacheKey,
  computeFetchLimit,
  isCacheSufficient,
  LeadSearchPipeline,
  type ExistingLead,
  type LeadSearchStore,
  type PreparedLead,
  type SaveSearchRecord,
  type SearchCacheEntry,
} from "@/lib/leads/search-pipeline";
import type { LeadProvider, LeadProviderResponse, LeadResult } from "@/lib/leads/types";
import { makeLead } from "./helpers";

const NOW = new Date("2026-09-16T12:00:00Z");

function crawlResult(overrides: Partial<WebsiteCrawlResult> = {}): WebsiteCrawlResult {
  return {
    status: "completed",
    finalUrl: null,
    pagesVisited: [],
    email: null,
    phone: null,
    hasMobilePhone: false,
    whatsappConfirmed: false,
    whatsapp: null,
    instagram: null,
    facebook: null,
    linkedin: null,
    ...overrides,
  };
}

/** Banco em memória que imita o repositório real. */
class MemoryStore implements LeadSearchStore<PreparedLead> {
  searches = new Map<string, SearchCacheEntry & { leadIds: string[] }>();
  saved = new Map<string, PreparedLead>();
  existing: ExistingLead[] = [];
  cacheHits = 0;
  usage: Array<{ success: boolean }> = [];

  async findSearch(cacheKey: string) {
    return this.searches.get(cacheKey) ?? null;
  }
  async registerCacheHit() {
    this.cacheHits += 1;
  }
  async findExistingLeads() {
    return this.existing;
  }
  async saveLeads(leads: readonly PreparedLead[]) {
    return leads.map((prepared) => {
      const id = prepared.existingId ?? `id-${prepared.lead.externalId}`;
      this.saved.set(id, prepared);
      return id;
    });
  }
  async saveSearch(record: SaveSearchRecord) {
    const id = `search-${record.cacheKey}`;
    this.searches.set(record.cacheKey, {
      id,
      fetchLimit: record.fetchLimit,
      rawCount: record.rawCount,
      expiresAt: new Date(NOW.getTime() + 60_000),
      sourceCounts: record.sourceCounts,
      warnings: [...record.warnings],
      leadIds: [...record.leadIds],
    });
    return id;
  }
  async readSearchLeads(searchId: string, filters: { hasPhone?: boolean }, limit: number) {
    const search = [...this.searches.values()].find((entry) => entry.id === searchId);
    return (search?.leadIds ?? [])
      .map((id) => this.saved.get(id))
      .filter((lead): lead is PreparedLead => Boolean(lead))
      .filter((prepared) => filters.hasPhone === undefined || Boolean(prepared.lead.phone) === filters.hasPhone)
      .slice(0, limit);
  }
  async recordUsage(usage: { success: boolean }) {
    this.usage.push(usage);
  }
}

function fakeProvider(leads: LeadResult[] | (() => Promise<LeadProviderResponse>)) {
  const calls: number[] = [];
  const provider: LeadProvider = {
    name: "openstreetmap",
    isEnabled: () => true,
    search: async (params) => {
      calls.push(params.limit);
      if (typeof leads === "function") return leads();
      return { leads, rawCount: leads.length, requests: 2, sourceCounts: { openstreetmap: leads.length }, warnings: [] };
    },
  };
  return { provider, calls };
}

function pipeline(
  store: MemoryStore,
  provider: LeadProvider,
  crawl: (url: string) => Promise<WebsiteCrawlResult> = async () => crawlResult(),
) {
  const crawled: string[] = [];
  const instance = new LeadSearchPipeline<PreparedLead>({
    provider,
    store,
    enrichmentTtlMs: 7 * 24 * 3600 * 1000,
    maxFetchLimit: 200,
    now: () => NOW,
    crawler: {
      enabled: true,
      concurrency: 2,
      maxSitesPerSearch: 10,
      crawl: async (url) => {
        crawled.push(url);
        return crawl(url);
      },
    },
  });
  return { instance, crawled };
}

const REQUEST = { query: "barbearia", city: "Osasco", state: "SP", extraCities: [], limit: 50, filters: {} };

describe("pipeline de busca e cache", () => {
  test("chave de cache equivalente para sinônimos e plural", () => {
    assert.equal(
      buildLeadSearchCacheKey("openstreetmap", { query: "Barbearias", city: "osasco", state: "SP", extraCities: [] }),
      buildLeadSearchCacheKey("openstreetmap", { query: "barber shop", city: "Osasco", state: "sp", extraCities: [] }),
    );
  });

  test("folga na quantidade pedida à fonte, maior com filtros, com teto", () => {
    assert.equal(computeFetchLimit(50, false, 200), 100);
    assert.equal(computeFetchLimit(10, false, 200), 30);
    assert.equal(computeFetchLimit(50, true, 200), 200);
    assert.equal(computeFetchLimit(150, false, 200), 200);
  });

  test("cache suficiente: já pediu o bastante ou a fonte se esgotou", () => {
    const expiresAt = NOW;
    assert.equal(isCacheSufficient({ id: "s", fetchLimit: 100, rawCount: 100, expiresAt, sourceCounts: {}, warnings: [] }, 100), true);
    assert.equal(isCacheSufficient({ id: "s", fetchLimit: 30, rawCount: 30, expiresAt, sourceCounts: {}, warnings: [] }, 100), false);
    assert.equal(isCacheSufficient({ id: "s", fetchLimit: 30, rawCount: 17, expiresAt, sourceCounts: {}, warnings: [] }, 100), true);
    assert.equal(isCacheSufficient({ id: "s", fetchLimit: null, rawCount: 0, expiresAt, sourceCounts: {}, warnings: [] }, 10), false);
  });

  test("primeira busca consulta a fonte; a repetição vem do banco sem nova chamada", async () => {
    const store = new MemoryStore();
    const { provider, calls } = fakeProvider([
      makeLead({ externalId: "node/1", name: "Barbearia A" }),
      makeLead({ externalId: "node/2", name: "Barbearia B", latitude: -23.6, longitude: -46.9 }),
    ]);
    const { instance } = pipeline(store, provider);

    const first = await instance.search(REQUEST);
    assert.equal(first.source, "provider");
    assert.equal(first.metadata.total, 2);
    assert.equal(first.metadata.openStreetMapResults, 2);
    assert.equal(calls.length, 1);

    const second = await instance.search({ ...REQUEST, query: "Barbearias" });
    assert.equal(second.source, "cache");
    assert.equal(second.metadata.cachedResults, 2);
    assert.equal(second.metadata.externalRequests, 0);
    assert.equal(calls.length, 1);
    assert.equal(store.cacheHits, 1);
  });

  test("encontrou menos que o pedido: devolve só as reais, sem completar", async () => {
    const store = new MemoryStore();
    const leads = Array.from({ length: 7 }, (_, index) =>
      makeLead({ externalId: `node/${index + 1}`, name: `Empresa ${index + 1}`, latitude: -23.5 - index * 0.01 }),
    );
    const { instance } = pipeline(store, fakeProvider(leads).provider);
    const outcome = await instance.search(REQUEST);
    assert.equal(outcome.leads.length, 7);
    assert.equal(outcome.metadata.total, 7);
  });

  test("zero resultados: lista vazia, total 0", async () => {
    const store = new MemoryStore();
    const { instance } = pipeline(store, fakeProvider([]).provider);
    const outcome = await instance.search(REQUEST);
    assert.deepEqual(outcome.leads, []);
    assert.equal(outcome.metadata.total, 0);
  });

  test("cache vencido é devolvido na hora e atualizado em segundo plano", async () => {
    const store = new MemoryStore();
    const { provider, calls } = fakeProvider([makeLead()]);
    const { instance } = pipeline(store, provider);
    await instance.search(REQUEST);

    const entry = [...store.searches.values()][0];
    entry.expiresAt = new Date(NOW.getTime() - 1);

    const tasks: Array<() => Promise<void>> = [];
    const stale = await instance.search(REQUEST, { scheduleBackground: (task) => tasks.push(task) });
    assert.equal(stale.source, "stale-cache");
    assert.equal(calls.length, 1);
    assert.equal(tasks.length, 1);

    await tasks[0]();
    assert.equal(calls.length, 2);
  });

  test("duplicados do lote e do banco são removidos", async () => {
    const store = new MemoryStore();
    store.existing = [
      {
        ...makeLead({ externalId: "node/99", name: "Barbearia Antiga", phone: "551134567890", email: "antigo@x.com.br", emailSource: "website" }),
        id: "existing-1",
        dbWebsiteStatus: "NOT_PROVIDED",
        enrichedAt: null,
        websiteHasHttps: null,
      },
    ];
    const { instance } = pipeline(
      store,
      fakeProvider([
        makeLead({ externalId: "node/1", name: "Barbearia Nova", phone: "(11) 3456-7890" }),
        makeLead({ externalId: "way/2", name: "Barbearia Nova", latitude: -23.5321 }),
      ]).provider,
    );

    const outcome = await instance.search(REQUEST);
    assert.equal(outcome.metadata.duplicatesRemoved, 1);
    assert.equal(outcome.metadata.cachedResults, 1);
    assert.equal(outcome.leads.length, 1);
    const [prepared] = outcome.leads;
    assert.equal(prepared.existingId, "existing-1");
    // O que o banco sabia continua, com a origem original.
    assert.equal(prepared.lead.email, "antigo@x.com.br");
    assert.equal(prepared.lead.emailSource, "website");
  });

  test("crawler enriquece, e falha no site não descarta a empresa", async () => {
    const store = new MemoryStore();
    const { instance, crawled } = pipeline(
      store,
      fakeProvider([
        makeLead({ externalId: "node/1", name: "Com site", website: "https://ok.com.br", websiteStatus: "found", enrichmentStatus: "pending" }),
        makeLead({ externalId: "node/2", name: "Site quebrado", website: "https://quebrado.com.br", websiteStatus: "found", enrichmentStatus: "pending", latitude: -23.6 }),
        makeLead({ externalId: "node/3", name: "Sem site", latitude: -23.7 }),
      ]).provider,
      async (url) => {
        if (url.includes("quebrado")) throw new Error("timeout");
        return crawlResult({ email: "contato@ok.com.br", whatsappConfirmed: true, whatsapp: "5511987654321" });
      },
    );

    const outcome = await instance.search(REQUEST);
    assert.deepEqual(crawled.sort(), ["https://ok.com.br", "https://quebrado.com.br"]);
    assert.equal(outcome.metadata.crawlerEnriched, 1);
    assert.equal(outcome.leads.length, 3);

    const byName = new Map(outcome.leads.map((prepared) => [prepared.lead.name, prepared]));
    const ok = byName.get("Com site");
    assert.equal(ok?.lead.email, "contato@ok.com.br");
    assert.equal(ok?.lead.whatsappStatus, "confirmed");
    assert.equal(ok?.enrichedNow, true);

    const broken = byName.get("Site quebrado");
    assert.equal(broken?.lead.enrichmentStatus, "failed");
    assert.equal(broken?.lead.email, null);

    const noSite = byName.get("Sem site");
    assert.equal(noSite?.dbWebsiteStatus, "NOT_PROVIDED");
    assert.equal(noSite?.lead.websiteStatus, "not_checked");
  });

  test("site lido recentemente não é baixado de novo", async () => {
    const store = new MemoryStore();
    store.existing = [
      {
        ...makeLead({ externalId: "node/1", website: "https://ok.com.br", websiteStatus: "found", enrichmentStatus: "completed", email: "a@ok.com.br" }),
        id: "existing-1",
        dbWebsiteStatus: "HAS_WEBSITE",
        enrichedAt: new Date(NOW.getTime() - 3600_000),
        websiteHasHttps: true,
      },
    ];
    const { instance, crawled } = pipeline(
      store,
      fakeProvider([makeLead({ externalId: "node/1", website: "https://ok.com.br", websiteStatus: "found", enrichmentStatus: "pending" })]).provider,
    );
    const outcome = await instance.search(REQUEST);
    assert.deepEqual(crawled, []);
    assert.equal(outcome.leads[0].lead.email, "a@ok.com.br");
    assert.equal(outcome.leads[0].lead.enrichmentStatus, "completed");
  });

  test("buscas idênticas simultâneas consultam a fonte uma vez só", async () => {
    const store = new MemoryStore();
    const { provider, calls } = fakeProvider([makeLead()]);
    const { instance } = pipeline(store, provider);
    await Promise.all([instance.search(REQUEST), instance.search(REQUEST)]);
    assert.equal(calls.length, 1);
  });

  test("fonte fora do ar: erro propagado e uso registrado como falha", async () => {
    const store = new MemoryStore();
    const { provider } = fakeProvider(async () => {
      throw new AppError("PROVIDER_UNAVAILABLE");
    });
    const { instance } = pipeline(store, provider);
    await assert.rejects(instance.search(REQUEST), AppError);
    assert.deepEqual(store.usage, [{ operation: "search", requests: 0, items: 0, success: false }]);
  });
});
