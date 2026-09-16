/**
 * Google Places API (New) - Text Search e Place Details.
 *
 * Economia de custo embutida:
 * - FieldMask minima e centralizada: pagamos so pelos campos que a UI usa.
 * - Details nunca roda em massa; so quando o usuario pede enriquecimento.
 * - Paginacao limitada por maxResultsPerSearch.
 *
 * Nao fazemos scraping da interface do Google Maps - apenas a API oficial.
 */

import { AppError } from "@/lib/errors";
import { fetchWithTimeout, isRetryableStatus, withRetry } from "@/lib/http";
import { createLogger } from "@/lib/logger";
import { cleanupText, normalizeCity, normalizePhone, normalizeState } from "@/lib/normalize";
import { serverConfig } from "@/server/config";
import type {
  LeadProvider,
  ProviderBusiness,
  ProviderBusinessDetails,
  ProviderResponse,
  ProviderSearchParams,
} from "@/types/provider";

const logger = createLogger("google-places");

const BASE_URL = "https://places.googleapis.com/v1";
const MAX_PAGE_SIZE = 20;

/** Campos da busca. Cada campo extra aqui aumenta o custo por requisicao. */
const SEARCH_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.addressComponents",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.primaryTypeDisplayName",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "nextPageToken",
].join(",");

/** Campos do detalhe, pedidos apenas no enriquecimento sob demanda. */
const DETAILS_FIELD_MASK = [
  "id",
  "displayName",
  "formattedAddress",
  "addressComponents",
  "location",
  "rating",
  "userRatingCount",
  "primaryTypeDisplayName",
  "internationalPhoneNumber",
  "nationalPhoneNumber",
  "websiteUri",
].join(",");

interface GoogleAddressComponent {
  longText?: string;
  shortText?: string;
  types?: string[];
}

interface GooglePlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  addressComponents?: GoogleAddressComponent[];
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  primaryTypeDisplayName?: { text?: string };
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
}

interface GoogleSearchResponse {
  places?: GooglePlace[];
  nextPageToken?: string;
}

function findComponent(
  components: GoogleAddressComponent[] | undefined,
  type: string,
): GoogleAddressComponent | undefined {
  return components?.find((component) => component.types?.includes(type));
}

function toProviderBusiness(place: GooglePlace): ProviderBusiness | null {
  const externalId = cleanupText(place.id);
  const name = cleanupText(place.displayName?.text);
  if (!externalId || !name) return null;

  const components = place.addressComponents;
  const city =
    findComponent(components, "locality")?.longText ??
    findComponent(components, "administrative_area_level_2")?.longText ??
    null;
  const state =
    findComponent(components, "administrative_area_level_1")?.shortText ??
    findComponent(components, "administrative_area_level_1")?.longText ??
    null;
  const neighborhood =
    findComponent(components, "sublocality_level_1")?.longText ??
    findComponent(components, "sublocality")?.longText ??
    null;

  return {
    externalId,
    name,
    category: cleanupText(place.primaryTypeDisplayName?.text),
    phone: normalizePhone(place.nationalPhoneNumber ?? place.internationalPhoneNumber),
    website: cleanupText(place.websiteUri),
    address: cleanupText(place.formattedAddress),
    neighborhood: normalizeCity(neighborhood),
    city: normalizeCity(city),
    state: normalizeState(state),
    country: cleanupText(findComponent(components, "country")?.shortText) ?? "BR",
    postalCode: cleanupText(findComponent(components, "postal_code")?.longText),
    latitude: place.location?.latitude ?? null,
    longitude: place.location?.longitude ?? null,
    rating: place.rating ?? null,
    reviewsCount: place.userRatingCount ?? null,
  };
}

/** Converte falhas HTTP em AppError com codigo que a UI sabe explicar. */
function errorFromStatus(status: number): AppError {
  if (status === 429) return new AppError("PROVIDER_RATE_LIMITED");
  if (status === 401) return new AppError("PROVIDER_NOT_CONFIGURED");
  // 403 nao e chave ausente: a chave chegou e foi recusada. Quase sempre e a
  // Places API (New) desativada, billing desligado ou restricao na chave.
  if (status === 403) {
    return new AppError(
      "PROVIDER_ERROR",
      "O Google recusou a chave. Verifique no Google Cloud se a Places API (New) " +
        "esta ativada, se o projeto tem billing ligado e se a chave nao esta " +
        "restrita a referenciadores HTTP (chamadas do servidor nao passam por essa restricao).",
    );
  }
  if (status >= 500) return new AppError("PROVIDER_UNAVAILABLE");
  return new AppError("PROVIDER_ERROR");
}

/** Monta o texto da busca: "clinica de estetica em Osasco, SP". */
function buildTextQuery(params: ProviderSearchParams): string {
  const place = [params.neighborhood, params.city, params.state].filter(Boolean).join(", ");
  return place ? `${params.term} em ${place}` : params.term;
}

export class GooglePlacesProvider implements LeadProvider {
  readonly name = "google_places";

  private readonly apiKey: string;

  constructor(apiKey: string = serverConfig.provider.googlePlacesApiKey) {
    this.apiKey = apiKey;
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  private async post<T>(path: string, body: unknown, fieldMask: string): Promise<T> {
    return withRetry(async () => {
      const response = await fetchWithTimeout(`${BASE_URL}${path}`, {
        method: "POST",
        timeoutMs: serverConfig.external.timeoutMs,
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": this.apiKey,
          "X-Goog-FieldMask": fieldMask,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        logger.warn("resposta de erro na busca", { status: response.status });
        const error = errorFromStatus(response.status);
        if (isRetryableStatus(response.status)) throw error;
        throw error;
      }
      return (await response.json()) as T;
    }, serverConfig.external.retry);
  }

  private async get<T>(path: string, fieldMask: string): Promise<T> {
    return withRetry(async () => {
      const response = await fetchWithTimeout(`${BASE_URL}${path}`, {
        method: "GET",
        timeoutMs: serverConfig.external.timeoutMs,
        headers: {
          "X-Goog-Api-Key": this.apiKey,
          "X-Goog-FieldMask": fieldMask,
        },
      });

      if (!response.ok) {
        logger.warn("resposta de erro no detalhe", { status: response.status });
        throw errorFromStatus(response.status);
      }
      return (await response.json()) as T;
    }, serverConfig.external.retry);
  }

  async searchBusinesses(
    params: ProviderSearchParams,
  ): Promise<ProviderResponse<ProviderBusiness[]>> {
    if (!this.isConfigured()) throw new AppError("PROVIDER_NOT_CONFIGURED");

    const businesses: ProviderBusiness[] = [];
    const seen = new Set<string>();
    let pageToken: string | undefined;
    let requests = 0;

    while (businesses.length < params.limit) {
      const remaining = params.limit - businesses.length;
      const body: Record<string, unknown> = {
        textQuery: buildTextQuery(params),
        maxResultCount: Math.min(MAX_PAGE_SIZE, remaining),
        languageCode: "pt-BR",
        regionCode: params.country ?? "BR",
      };
      if (pageToken) body.pageToken = pageToken;
      if (params.latitude !== null && params.longitude !== null && params.radiusMeters) {
        body.locationBias = {
          circle: {
            center: { latitude: params.latitude, longitude: params.longitude },
            radius: params.radiusMeters,
          },
        };
      }

      const payload = await this.post<GoogleSearchResponse>(
        "/places:searchText",
        body,
        SEARCH_FIELD_MASK,
      );
      requests += 1;

      for (const place of payload.places ?? []) {
        const business = toProviderBusiness(place);
        if (business && !seen.has(business.externalId)) {
          seen.add(business.externalId);
          businesses.push(business);
        }
      }

      if (!payload.nextPageToken || (payload.places ?? []).length === 0) break;
      pageToken = payload.nextPageToken;
    }

    logger.info("busca concluida", { requests, encontrados: businesses.length });
    return { data: businesses, requests };
  }

  async getBusinessDetails(
    externalId: string,
  ): Promise<ProviderResponse<ProviderBusinessDetails | null>> {
    if (!this.isConfigured()) throw new AppError("PROVIDER_NOT_CONFIGURED");

    const place = await this.get<GooglePlace>(
      `/places/${encodeURIComponent(externalId)}`,
      DETAILS_FIELD_MASK,
    );
    const business = toProviderBusiness(place);
    if (!business) return { data: null, requests: 1 };

    // O Places nao expoe e-mail nem redes sociais; ficam para outros
    // enriquecedores (ex.: leitura do proprio site) na Fase 2.
    return { data: { ...business, email: null, socialLinks: [] }, requests: 1 };
  }
}
