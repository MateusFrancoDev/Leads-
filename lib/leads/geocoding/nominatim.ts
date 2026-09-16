/**
 * Descobre a área de uma cidade no OpenStreetMap via Nominatim.
 *
 * Regras de uso do serviço público (https://operations.osmfoundation.org/policies/nominatim/):
 * no máximo 1 requisição por segundo, User-Agent identificável e cache dos
 * resultados. Por isso:
 * - só geocodificamos a CIDADE, nunca cada empresa;
 * - o resultado vai para um cache (memória + banco) e é reaproveitado por
 *   qualquer busca futura na mesma cidade;
 * - as chamadas passam por um MinIntervalRateLimiter.
 */

import { AppError } from "@/lib/errors";
import { MinIntervalRateLimiter } from "@/lib/leads/rate-limiter";
import type { OsmElementType } from "@/lib/leads/location";
import { normalizeForComparison, normalizeState, stateNameFromCode } from "@/lib/normalize";

export interface CityArea {
  /** Cidade + UF normalizadas (ex.: "osasco|sp"). */
  key: string;
  city: string;
  state: string;
  displayName: string;
  osmType: OsmElementType;
  osmId: string;
  latitude: number;
  longitude: number;
  south: number;
  north: number;
  west: number;
  east: number;
}

/** Onde as áreas ficam guardadas entre execuções (o servidor usa o banco). */
export interface CityAreaStore {
  get(key: string): Promise<CityArea | null>;
  set(area: CityArea): Promise<void>;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface NominatimGeocoderOptions {
  baseUrl: string;
  userAgent: string;
  minIntervalMs: number;
  timeoutMs: number;
  store?: CityAreaStore;
  fetch?: FetchLike;
  rateLimiter?: MinIntervalRateLimiter;
}

interface NominatimPlace {
  osm_type?: string;
  osm_id?: number;
  lat?: string;
  lon?: string;
  boundingbox?: string[];
  display_name?: string;
  class?: string;
  addresstype?: string;
  name?: string;
  address?: Record<string, string>;
}

export function buildCityKey(city: string, state: string): string {
  return `${normalizeForComparison(city)}|${state.trim().toLowerCase()}`;
}

function toNumber(value: string | undefined): number | null {
  if (value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Nome do município no endereço devolvido pelo Nominatim. */
function municipalityOf(place: NominatimPlace): string {
  const address = place.address ?? {};
  return address.city ?? address.town ?? address.municipality ?? address.village ?? place.name ?? "";
}

/** Escolhe o resultado que é de fato o município pedido, na UF pedida. */
export function pickCityPlace(
  places: readonly NominatimPlace[],
  city: string,
  state: string,
): NominatimPlace | null {
  const expectedCity = normalizeForComparison(city);
  const inState = places.filter((place) => {
    const iso = place.address?.["ISO3166-2-lvl4"];
    if (iso) return iso.toUpperCase() === `BR-${state}`;
    return normalizeState(place.address?.state) === state;
  });

  const sameCity = inState.filter((place) => normalizeForComparison(municipalityOf(place)) === expectedCity);
  const pool = sameCity.length > 0 ? sameCity : inState;

  return (
    pool.find((place) => place.osm_type === "relation" && place.class === "boundary") ??
    pool.find((place) => place.osm_type === "relation") ??
    pool[0] ??
    null
  );
}

function toCityArea(place: NominatimPlace, city: string, state: string): CityArea | null {
  const type = place.osm_type;
  if (type !== "node" && type !== "way" && type !== "relation") return null;
  if (typeof place.osm_id !== "number") return null;

  const latitude = toNumber(place.lat);
  const longitude = toNumber(place.lon);
  const box = place.boundingbox ?? [];
  if (box.length !== 4) return null;
  const [south, north, west, east] = box.map((value) => toNumber(value));
  if (
    latitude === null ||
    longitude === null ||
    south === null ||
    north === null ||
    west === null ||
    east === null
  ) {
    return null;
  }

  return {
    key: buildCityKey(city, state),
    city: municipalityOf(place) || city,
    state,
    displayName: place.display_name ?? `${city}, ${state}`,
    osmType: type,
    osmId: String(place.osm_id),
    latitude,
    longitude,
    south,
    north,
    west,
    east,
  };
}

export class NominatimGeocoder {
  private readonly options: NominatimGeocoderOptions;
  private readonly fetchImpl: FetchLike;
  private readonly rateLimiter: MinIntervalRateLimiter;
  private readonly memory = new Map<string, CityArea>();
  private readonly inFlight = new Map<string, Promise<CityArea>>();

  constructor(options: NominatimGeocoderOptions) {
    this.options = options;
    this.fetchImpl = options.fetch ?? ((input, init) => fetch(input, init));
    this.rateLimiter = options.rateLimiter ?? new MinIntervalRateLimiter(options.minIntervalMs);
  }

  /**
   * Área da cidade. Consulta o Nominatim só quando nem a memória nem o banco
   * conhecem a cidade. `requests` informa quantas chamadas reais aconteceram.
   */
  async resolveCity(city: string, stateInput: string): Promise<{ area: CityArea; requests: number }> {
    const state = normalizeState(stateInput);
    if (!state) throw new AppError("INVALID_INPUT", "Informe uma UF válida (ex.: SP).");
    const key = buildCityKey(city, state);

    const remembered = this.memory.get(key);
    if (remembered) return { area: remembered, requests: 0 };

    const stored = await this.readStore(key);
    if (stored) {
      this.memory.set(key, stored);
      return { area: stored, requests: 0 };
    }

    // Duas buscas simultâneas na mesma cidade dividem a mesma chamada.
    const pending = this.inFlight.get(key);
    if (pending) return { area: await pending, requests: 0 };

    const lookup = this.lookup(city, state).finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, lookup);
    const area = await lookup;
    return { area, requests: 1 };
  }

  private async readStore(key: string): Promise<CityArea | null> {
    if (!this.options.store) return null;
    try {
      return await this.options.store.get(key);
    } catch {
      // Cache indisponível não impede a busca: segue para o Nominatim.
      return null;
    }
  }

  private async lookup(city: string, state: string): Promise<CityArea> {
    const params = new URLSearchParams({
      city,
      state: stateNameFromCode(state) ?? state,
      country: "Brasil",
      countrycodes: "br",
      format: "jsonv2",
      addressdetails: "1",
      limit: "5",
      "accept-language": "pt-BR",
    });
    const url = `${this.options.baseUrl.replace(/\/+$/, "")}/search?${params.toString()}`;

    const places = await this.rateLimiter.schedule(async () => {
      let response: Response;
      try {
        response = await this.fetchImpl(url, {
          headers: { "User-Agent": this.options.userAgent, Accept: "application/json" },
          signal: AbortSignal.timeout(this.options.timeoutMs),
        });
      } catch (error) {
        throw new AppError(
          "PROVIDER_UNAVAILABLE",
          "Não foi possível localizar a cidade agora (Nominatim não respondeu). Tente novamente em instantes.",
          error,
        );
      }
      if (response.status === 429) {
        throw new AppError(
          "PROVIDER_RATE_LIMITED",
          "O serviço de localização do OpenStreetMap pediu uma pausa. Aguarde um minuto e tente de novo.",
        );
      }
      if (!response.ok) {
        throw new AppError(
          "PROVIDER_UNAVAILABLE",
          "Não foi possível localizar a cidade agora (Nominatim indisponível). Tente novamente em instantes.",
        );
      }
      try {
        const payload: unknown = await response.json();
        return Array.isArray(payload) ? (payload as NominatimPlace[]) : [];
      } catch (error) {
        throw new AppError("PROVIDER_ERROR", "Resposta inválida do serviço de localização.", error);
      }
    });

    const place = pickCityPlace(places, city, state);
    const area = place ? toCityArea(place, city, state) : null;
    if (!area) {
      throw new AppError(
        "NOT_FOUND",
        `Não encontramos a cidade "${city}/${state}" no OpenStreetMap. Confira a grafia e a UF.`,
      );
    }

    this.memory.set(area.key, area);
    if (this.options.store) {
      try {
        await this.options.store.set(area);
      } catch {
        // Falha ao gravar o cache não invalida a área já obtida.
      }
    }
    return area;
  }
}
