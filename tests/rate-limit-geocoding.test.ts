import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { AppError } from "@/lib/errors";
import { NominatimGeocoder, pickCityPlace, type CityArea, type CityAreaStore } from "@/lib/leads/geocoding/nominatim";
import { MinIntervalRateLimiter } from "@/lib/leads/rate-limiter";

/** Relógio falso: sleep avança o tempo em vez de esperar. */
function fakeClock() {
  let now = 0;
  return {
    now: () => now,
    sleep: async (ms: number) => {
      now += ms;
    },
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe("rate limit", () => {
  test("respeita o intervalo mínimo entre inícios, em ordem", async () => {
    const clock = fakeClock();
    const limiter = new MinIntervalRateLimiter(1100, clock);
    const starts: number[] = [];
    await Promise.all([1, 2, 3].map((id) => limiter.schedule(async () => starts.push(clock.now()) && id)));
    assert.deepEqual(starts, [0, 1100, 2200]);
  });

  test("não espera quando o intervalo já passou", async () => {
    const clock = fakeClock();
    const limiter = new MinIntervalRateLimiter(1000, clock);
    await limiter.schedule(async () => undefined);
    clock.advance(5000);
    const before = clock.now();
    await limiter.schedule(async () => undefined);
    assert.equal(clock.now(), before);
  });

  test("uma tarefa que falha não trava a fila", async () => {
    const limiter = new MinIntervalRateLimiter(0);
    await assert.rejects(limiter.schedule(async () => Promise.reject(new Error("x"))));
    assert.equal(await limiter.schedule(async () => "ok"), "ok");
  });
});

const PLACE = {
  osm_type: "relation",
  osm_id: 298175,
  lat: "-23.53",
  lon: "-46.79",
  boundingbox: ["-23.58", "-23.47", "-46.83", "-46.73"],
  display_name: "Osasco, Região Metropolitana de São Paulo, São Paulo, Brasil",
  class: "boundary",
  addresstype: "city",
  name: "Osasco",
  address: { city: "Osasco", state: "São Paulo", "ISO3166-2-lvl4": "BR-SP" },
};

function memoryStore(): CityAreaStore & { data: Map<string, CityArea> } {
  const data = new Map<string, CityArea>();
  return {
    data,
    get: async (key) => data.get(key) ?? null,
    set: async (area) => {
      data.set(area.key, area);
    },
  };
}

describe("Nominatim", () => {
  test("escolhe o município da UF certa", () => {
    const wrongState = { ...PLACE, osm_id: 1, address: { city: "Osasco", "ISO3166-2-lvl4": "BR-MG" } };
    assert.equal(pickCityPlace([wrongState, PLACE], "Osasco", "SP")?.osm_id, 298175);
    assert.equal(pickCityPlace([wrongState], "Osasco", "SP"), null);
  });

  test("geocodifica uma vez e reaproveita o cache (memória e banco)", async () => {
    let calls = 0;
    let lastUrl = "";
    const store = memoryStore();
    const options = {
      baseUrl: "https://nominatim.example",
      userAgent: "Prospecta-test",
      minIntervalMs: 0,
      timeoutMs: 1000,
      store,
      fetch: async (url: string, init?: RequestInit) => {
        calls += 1;
        lastUrl = url;
        assert.equal(new Headers(init?.headers).get("User-Agent"), "Prospecta-test");
        return new Response(JSON.stringify([PLACE]));
      },
    };

    const geocoder = new NominatimGeocoder(options);
    const first = await geocoder.resolveCity("Osasco", "SP");
    const second = await geocoder.resolveCity("osasco", "sp");
    assert.equal(first.requests, 1);
    assert.equal(second.requests, 0);
    assert.equal(calls, 1);
    assert.match(lastUrl, /city=Osasco/);
    assert.equal(first.area.osmId, "298175");
    assert.equal(store.data.size, 1);

    // Outro processo (memória vazia) usa o cache do banco.
    const restarted = new NominatimGeocoder(options);
    const third = await restarted.resolveCity("Osasco", "SP");
    assert.equal(third.requests, 0);
    assert.equal(calls, 1);
  });

  test("buscas simultâneas na mesma cidade fazem uma chamada só", async () => {
    let calls = 0;
    const geocoder = new NominatimGeocoder({
      baseUrl: "https://nominatim.example",
      userAgent: "test",
      minIntervalMs: 0,
      timeoutMs: 1000,
      fetch: async () => {
        calls += 1;
        return new Response(JSON.stringify([PLACE]));
      },
    });
    await Promise.all([geocoder.resolveCity("Osasco", "SP"), geocoder.resolveCity("Osasco", "SP")]);
    assert.equal(calls, 1);
  });

  test("cidade inexistente e serviço fora do ar viram erros amigáveis", async () => {
    const notFound = new NominatimGeocoder({
      baseUrl: "https://nominatim.example",
      userAgent: "test",
      minIntervalMs: 0,
      timeoutMs: 1000,
      fetch: async () => new Response("[]"),
    });
    await assert.rejects(notFound.resolveCity("Cidade Inventada", "SP"), (error: unknown) => error instanceof AppError && error.code === "NOT_FOUND");

    const down = new NominatimGeocoder({
      baseUrl: "https://nominatim.example",
      userAgent: "test",
      minIntervalMs: 0,
      timeoutMs: 1000,
      fetch: async () => new Response("erro", { status: 503 }),
    });
    await assert.rejects(down.resolveCity("Osasco", "SP"), (error: unknown) => error instanceof AppError && error.code === "PROVIDER_UNAVAILABLE");
  });
});
