/**
 * OpenStreetMap via Overpass API - fonte gratuita, sem chave e sem cartao.
 *
 * Diferencas em relacao ao Google Places, que a interface precisa respeitar:
 * - NAO existe nota nem numero de avaliacoes no OSM (rating/reviewsCount = null);
 * - a cobertura e o que voluntarios mapearam, bem menor que a do Google;
 * - a busca e por etiqueta estruturada (shop=beauty), nao por texto livre, por
 *   isso o termo do usuario passa por um dicionario de nichos antes de virar
 *   consulta - com uma busca por nome como plano B.
 *
 * Etiqueta de uso: o Overpass e um servico comunitario e gratuito. Mandamos
 * User-Agent identificavel, um timeout explicito e uma consulta por pesquisa;
 * o cache do banco cuida para nao repetir.
 */

import { AppError } from "@/lib/errors";
import { fetchWithTimeout, withRetry } from "@/lib/http";
import { createLogger } from "@/lib/logger";
import { cleanupText, normalizeCity, normalizePhone, normalizeState, normalizeText } from "@/lib/normalize";
import { serverConfig } from "@/server/config";
import type {
  LeadProvider,
  ProviderBusiness,
  ProviderBusinessDetails,
  ProviderResponse,
  ProviderSearchParams,
} from "@/types/provider";

const logger = createLogger("openstreetmap");

const ENDPOINT = "https://overpass-api.de/api/interpreter";
const USER_AGENT = "Prospecta/1.0 (prospeccao B2B; contato via aplicacao local)";

/** Timeout declarado ao Overpass, em segundos (o nosso fetch tem o proprio). */
const QUERY_TIMEOUT_SECONDS = 50;

/** Chaves que caracterizam um estabelecimento comercial no OSM. */
const BUSINESS_KEYS = ["shop", "amenity", "office", "craft", "healthcare", "leisure", "tourism"];

interface NicheEntry {
  /** Palavras que o usuario costuma digitar (ja normalizadas). */
  match: string[];
  /** Filtros OSM no formato chave=valor. */
  filters: string[];
  label: string;
}

/**
 * Dicionario de nichos. Cobre o que se prospecta com mais frequencia no
 * Brasil; termos fora daqui caem na busca por nome.
 */
const NICHES: readonly NicheEntry[] = [
  {
    match: ["estetica", "salao", "beleza", "cabeleireiro", "barbearia", "barbeiro", "manicure", "unha"],
    filters: ["shop=beauty", "shop=hairdresser"],
    label: "Beleza e estetica",
  },
  { match: ["dentista", "odonto", "odontologia"], filters: ["amenity=dentist"], label: "Odontologia" },
  {
    match: ["clinica", "medico", "consultorio", "medica"],
    filters: ["amenity=clinic", "amenity=doctors"],
    label: "Clinica medica",
  },
  {
    match: ["fisioterapia", "fisioterapeuta"],
    filters: ["healthcare=physiotherapist"],
    label: "Fisioterapia",
  },
  { match: ["psicologo", "psicologia", "terapeuta"], filters: ["healthcare=psychotherapist"], label: "Psicologia" },
  { match: ["laboratorio", "exames"], filters: ["healthcare=laboratory"], label: "Laboratorio" },
  { match: ["veterinario", "veterinaria"], filters: ["amenity=veterinary"], label: "Veterinaria" },
  { match: ["petshop", "pet shop", "pet"], filters: ["shop=pet"], label: "Pet shop" },
  { match: ["academia", "musculacao", "crossfit", "pilates"], filters: ["leisure=fitness_centre"], label: "Academia" },
  { match: ["restaurante", "comida"], filters: ["amenity=restaurant"], label: "Restaurante" },
  { match: ["pizzaria", "pizza"], filters: ["amenity=restaurant", "amenity=fast_food"], label: "Pizzaria" },
  { match: ["lanchonete", "hamburgueria", "hamburguer", "lanche"], filters: ["amenity=fast_food"], label: "Lanchonete" },
  { match: ["padaria", "panificadora"], filters: ["shop=bakery"], label: "Padaria" },
  { match: ["cafe", "cafeteria"], filters: ["amenity=cafe"], label: "Cafeteria" },
  { match: ["bar", "boteco", "pub"], filters: ["amenity=bar", "amenity=pub"], label: "Bar" },
  { match: ["farmacia", "drogaria"], filters: ["amenity=pharmacy"], label: "Farmacia" },
  { match: ["advogado", "advocacia", "juridico"], filters: ["office=lawyer"], label: "Advocacia" },
  { match: ["contabilidade", "contador", "contabil"], filters: ["office=accountant"], label: "Contabilidade" },
  { match: ["imobiliaria", "corretor", "imoveis"], filters: ["office=estate_agent"], label: "Imobiliaria" },
  { match: ["seguro", "seguros", "corretora"], filters: ["office=insurance"], label: "Seguros" },
  { match: ["oficina", "mecanica", "funilaria"], filters: ["shop=car_repair"], label: "Oficina mecanica" },
  { match: ["autopecas", "auto pecas", "pecas"], filters: ["shop=car_parts"], label: "Autopecas" },
  { match: ["lava rapido", "lavagem", "estetica automotiva"], filters: ["shop=car_wash"], label: "Lava rapido" },
  { match: ["otica", "oculos"], filters: ["shop=optician"], label: "Otica" },
  { match: ["joalheria", "joias", "relojoaria"], filters: ["shop=jewelry"], label: "Joalheria" },
  { match: ["floricultura", "flores"], filters: ["shop=florist"], label: "Floricultura" },
  {
    match: ["material de construcao", "construcao", "ferragem"],
    filters: ["shop=doityourself", "shop=hardware"],
    label: "Material de construcao",
  },
  { match: ["moveis", "movelaria"], filters: ["shop=furniture"], label: "Moveis" },
  { match: ["roupa", "roupas", "moda", "boutique"], filters: ["shop=clothes"], label: "Vestuario" },
  { match: ["calcados", "sapato", "sapataria"], filters: ["shop=shoes"], label: "Calcados" },
  { match: ["mercado", "supermercado", "mercearia"], filters: ["shop=supermarket"], label: "Supermercado" },
  { match: ["escola", "curso", "idiomas", "ingles"], filters: ["amenity=school", "amenity=language_school"], label: "Ensino" },
  { match: ["hotel", "pousada", "hospedagem"], filters: ["tourism=hotel", "tourism=guest_house"], label: "Hospedagem" },
];

function findNiche(term: string): NicheEntry | null {
  const normalized = normalizeText(term);
  return (
    NICHES.find((niche) => niche.match.some((word) => normalized.includes(word))) ?? null
  );
}

/** Escapa aspas para nao quebrar a Overpass QL. */
function quote(value: string): string {
  return value.replace(/["\\]/g, "");
}

/**
 * Monta a consulta. Sem cidade nao ha como delimitar a area: uma varredura
 * aberta derrubaria o servico publico e nao devolveria nada util.
 */
function buildQuery(params: ProviderSearchParams): { query: string; label: string | null } {
  const city = cleanupText(params.city);
  if (!city) {
    throw new AppError(
      "INVALID_INPUT",
      "A busca gratuita (OpenStreetMap) precisa de uma cidade para delimitar a area. " +
        "Informe a cidade e tente de novo.",
    );
  }

  const area = `area["name"="${quote(city)}"]["admin_level"="8"]->.a;`;
  const niche = findNiche(params.term);
  const parts: string[] = [];

  if (niche) {
    for (const filter of niche.filters) {
      const [key, value] = filter.split("=");
      for (const type of ["node", "way"]) {
        parts.push(`${type}["${key}"="${value}"](area.a);`);
      }
    }
  } else {
    // Plano B: qualquer estabelecimento cujo nome contenha o termo.
    const term = quote(params.term);
    for (const key of BUSINESS_KEYS) {
      for (const type of ["node", "way"]) {
        parts.push(`${type}["${key}"]["name"~"${term}",i](area.a);`);
      }
    }
  }

  const query = `[out:json][timeout:${QUERY_TIMEOUT_SECONDS}];${area}(${parts.join("")});out center tags;`;
  return { query, label: niche?.label ?? null };
}

interface OverpassElement {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements?: OverpassElement[];
}

function tag(tags: Record<string, string>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = cleanupText(tags[key]);
    if (value) return value;
  }
  return null;
}

/** Endereco a partir das etiquetas addr:* do OSM. */
function buildAddress(tags: Record<string, string>): string | null {
  const street = tag(tags, "addr:street");
  const number = tag(tags, "addr:housenumber");
  if (!street) return null;
  return number ? `${street}, ${number}` : street;
}

function toProviderBusiness(
  element: OverpassElement,
  params: ProviderSearchParams,
  label: string | null,
): ProviderBusiness | null {
  const tags = element.tags;
  if (!tags || !element.type || element.id === undefined) return null;

  const name = cleanupText(tags.name);
  if (!name) return null;

  const latitude = element.lat ?? element.center?.lat ?? null;
  const longitude = element.lon ?? element.center?.lon ?? null;

  return {
    externalId: `${element.type}/${element.id}`,
    name,
    category: label ?? tag(tags, "shop", "amenity", "office", "craft", "healthcare"),
    phone: normalizePhone(tag(tags, "phone", "contact:phone", "contact:mobile")),
    website: tag(tags, "website", "contact:website"),
    address: buildAddress(tags),
    neighborhood: normalizeCity(tag(tags, "addr:suburb", "addr:neighbourhood")),
    city: normalizeCity(tag(tags, "addr:city") ?? params.city),
    state: normalizeState(tag(tags, "addr:state") ?? params.state),
    country: "BR",
    postalCode: tag(tags, "addr:postcode"),
    latitude,
    longitude,
    // O OpenStreetMap nao tem avaliacoes. Deixar null e correto: a interface
    // mostra "-" em vez de fingir uma nota que nao existe.
    rating: null,
    reviewsCount: null,
  };
}

export class OpenStreetMapProvider implements LeadProvider {
  readonly name = "openstreetmap";

  /** Nao existe chave: a fonte esta sempre disponivel. */
  isConfigured(): boolean {
    return true;
  }

  private async run(query: string): Promise<OverpassElement[]> {
    return withRetry(async () => {
      const response = await fetchWithTimeout(ENDPOINT, {
        method: "POST",
        timeoutMs: Math.max(serverConfig.external.timeoutMs, (QUERY_TIMEOUT_SECONDS + 10) * 1000),
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": USER_AGENT,
        },
        body: `data=${encodeURIComponent(query)}`,
      });

      if (!response.ok) {
        logger.warn("resposta de erro", { status: response.status });
        if (response.status === 429) {
          throw new AppError(
            "PROVIDER_RATE_LIMITED",
            "O servico gratuito do OpenStreetMap esta limitando as consultas. Aguarde um minuto.",
          );
        }
        if (response.status === 504 || response.status >= 500) {
          throw new AppError("PROVIDER_UNAVAILABLE");
        }
        throw new AppError("PROVIDER_ERROR");
      }

      const payload = (await response.json()) as OverpassResponse;
      return payload.elements ?? [];
    }, serverConfig.external.retry);
  }

  async searchBusinesses(
    params: ProviderSearchParams,
  ): Promise<ProviderResponse<ProviderBusiness[]>> {
    const { query, label } = buildQuery(params);
    const elements = await this.run(query);

    const businesses: ProviderBusiness[] = [];
    const seen = new Set<string>();

    for (const element of elements) {
      if (businesses.length >= params.limit) break;
      const business = toProviderBusiness(element, params, label);
      if (business && !seen.has(business.externalId)) {
        seen.add(business.externalId);
        businesses.push(business);
      }
    }

    logger.info("busca concluida", {
      nicho: label ?? "por nome",
      retornados: elements.length,
      aproveitados: businesses.length,
    });
    return { data: businesses, requests: 1 };
  }

  /** Detalhe de um elemento: traz e-mail e redes sociais das etiquetas. */
  async getBusinessDetails(
    externalId: string,
  ): Promise<ProviderResponse<ProviderBusinessDetails | null>> {
    const [type, id] = externalId.split("/");
    if (!type || !id || !/^\d+$/.test(id)) return { data: null, requests: 0 };

    const query = `[out:json][timeout:${QUERY_TIMEOUT_SECONDS}];${type}(${id});out center tags;`;
    const [element] = await this.run(query);
    if (!element?.tags) return { data: null, requests: 1 };

    const empty: ProviderSearchParams = {
      term: "",
      city: null,
      state: null,
      neighborhood: null,
      country: "BR",
      latitude: null,
      longitude: null,
      radiusMeters: null,
      limit: 1,
    };
    const business = toProviderBusiness(element, empty, null);
    if (!business) return { data: null, requests: 1 };

    const tags = element.tags;
    const socialLinks = [
      tag(tags, "contact:instagram"),
      tag(tags, "contact:facebook"),
      tag(tags, "contact:linkedin"),
    ].filter((value): value is string => value !== null);

    return {
      data: {
        ...business,
        email: tag(tags, "email", "contact:email"),
        socialLinks,
      },
      requests: 1,
    };
  }
}
