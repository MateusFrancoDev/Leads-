import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { AppError } from "@/lib/errors";
import { mapCategory } from "@/lib/leads/category-mapper";
import type { CityArea } from "@/lib/leads/geocoding/nominatim";
import { buildOverpassQuery, OpenStreetMapProvider, sanitizeNameTerm, toSearchArea } from "@/lib/leads/providers/openstreetmap";
import { OverpassClient, type OverpassRunResult } from "@/lib/leads/providers/overpass-client";

const PRIMARY = "https://primary.example/api/interpreter";
const FALLBACK = "https://fallback.example/api/interpreter";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function client(responses: Array<Response | Error>, calls: string[], maxAttempts = 3) {
  return new OverpassClient({
    endpoints: [PRIMARY, FALLBACK],
    timeoutMs: 5000,
    maxAttempts,
    userAgent: "test",
    minIntervalMs: 0,
    retryDelayMs: 0,
    sleep: async () => undefined,
    fetch: async (url) => {
      calls.push(url);
      const next = responses.shift();
      if (!next) throw new Error("sem resposta configurada");
      if (next instanceof Error) throw next;
      return next;
    },
  });
}

describe("fallback do Overpass", () => {
  test("usa a instância principal quando ela responde", async () => {
    const calls: string[] = [];
    const result = await client([jsonResponse({ elements: [{ type: "node", id: 1 }] })], calls).run("q");
    assert.deepEqual(calls, [PRIMARY]);
    assert.equal(result.requests, 1);
    assert.equal(result.elements.length, 1);
  });

  for (const status of [429, 502, 503, 504]) {
    test(`HTTP ${status} na principal tenta o fallback`, async () => {
      const calls: string[] = [];
      const result = await client([jsonResponse({}, status), jsonResponse({ elements: [] })], calls).run("q");
      assert.deepEqual(calls, [PRIMARY, FALLBACK]);
      assert.equal(result.endpoint, FALLBACK);
      assert.equal(result.requests, 2);
    });
  }

  test("timeout de rede e 'Query timed out' também contam como falha transitória", async () => {
    const calls: string[] = [];
    await client(
      [new DOMException("timeout", "TimeoutError"), jsonResponse({ elements: [], remark: "runtime error: Query timed out" }), jsonResponse({ elements: [] })],
      calls,
    ).run("q");
    assert.deepEqual(calls, [PRIMARY, FALLBACK, PRIMARY]);
  });

  test("não alterna para sempre: para no máximo de tentativas", async () => {
    const calls: string[] = [];
    await assert.rejects(
      client([jsonResponse({}, 503), jsonResponse({}, 503), jsonResponse({}, 503), jsonResponse({}, 503)], calls).run("q"),
      (error: unknown) => error instanceof AppError && error.code === "PROVIDER_UNAVAILABLE",
    );
    assert.equal(calls.length, 3);
  });

  test("limite de consultas vira erro amigável de rate limit", async () => {
    await assert.rejects(
      client([jsonResponse({}, 429), jsonResponse({}, 429)], [], 2).run("q"),
      (error: unknown) => error instanceof AppError && error.code === "PROVIDER_RATE_LIMITED",
    );
  });

  test("erro definitivo (400) não tenta de novo", async () => {
    const calls: string[] = [];
    await assert.rejects(client([jsonResponse({}, 400)], calls).run("q"), AppError);
    assert.deepEqual(calls, [PRIMARY]);
  });
});

const OSASCO: CityArea = {
  key: "osasco|sp",
  city: "Osasco",
  state: "SP",
  displayName: "Osasco, São Paulo, Brasil",
  osmType: "relation",
  osmId: "298175",
  latitude: -23.53,
  longitude: -46.79,
  south: -23.58,
  north: -23.47,
  west: -46.83,
  east: -46.73,
};

describe("consulta Overpass", () => {
  test("delimitada pela área do município, com timeout, quantidade e node/way/relation", () => {
    const query = buildOverpassQuery({
      area: toSearchArea(OSASCO),
      rule: mapCategory("barbearia"),
      term: "barbearia",
      limit: 100,
      timeoutSeconds: 15,
    });
    assert.match(query, /^\[out:json\]\[timeout:15\];/);
    assert.match(query, /area\(id:3600298175\)->\.searchArea;/);
    assert.match(query, /nwr\["shop"="hairdresser"\]\["hairdresser"="barber"\]\["name"\]\(area\.searchArea\);/);
    assert.match(query, /\["name"~"b\[aáàâã\]rb",i\]/);
    assert.match(query, /out tags center 100;$/);
  });

  test("sem limite oficial, usa a caixa da cidade", () => {
    const query = buildOverpassQuery({
      area: toSearchArea({ ...OSASCO, osmType: "node" }),
      rule: mapCategory("dentista"),
      term: "dentista",
      limit: 10,
      timeoutSeconds: 15,
    });
    assert.match(query, /\(-23\.58,-46\.83,-23\.47,-46\.73\);/);
    assert.doesNotMatch(query, /searchArea/);
  });

  test("termo livre é sanitizado antes de entrar na consulta", () => {
    assert.equal(sanitizeNameTerm('Açaí "x"]; out;'), "acai x out");
    const query = buildOverpassQuery({
      area: toSearchArea(OSASCO),
      rule: null,
      term: 'Açaí "x"',
      limit: 5,
      timeoutSeconds: 15,
    });
    assert.doesNotMatch(query, /"x"/);
    assert.match(query, /nwr\["shop"\]\["name"~"/);
  });

  test("provider devolve só elementos reais normalizados e conta requisições", async () => {
    const provider = new OpenStreetMapProvider({
      enabled: true,
      overpassTimeoutMs: 15000,
      geocoder: { resolveCity: async () => ({ area: OSASCO, requests: 1 }) },
      overpass: {
        run: async (): Promise<OverpassRunResult> => ({
          endpoint: PRIMARY,
          requests: 1,
          elements: [
            { type: "node", id: 10, lat: -23.53, lon: -46.79, tags: { name: "Barbearia A", shop: "hairdresser" } },
            { type: "node", id: 10, lat: -23.53, lon: -46.79, tags: { name: "Barbearia A", shop: "hairdresser" } },
            { type: "node", id: 11, lat: -23.53, lon: -46.79, tags: { shop: "hairdresser" } },
          ],
        }),
      },
    });

    const response = await provider.search({ query: "barbearia", city: "Osasco", state: "SP", extraCities: [], limit: 50 });
    assert.equal(response.rawCount, 3);
    assert.equal(response.requests, 2);
    assert.equal(response.leads.length, 1);
    assert.equal(response.leads[0].category, "Barbearia");
  });

  test("provider desligado não consulta nada", async () => {
    const provider = new OpenStreetMapProvider({
      enabled: false,
      overpassTimeoutMs: 15000,
      geocoder: { resolveCity: async () => assert.fail("não deveria geocodificar") },
      overpass: { run: async () => assert.fail("não deveria consultar") },
    });
    await assert.rejects(provider.search({ query: "x", city: "Osasco", state: "SP", extraCities: [], limit: 1 }), AppError);
  });
});
