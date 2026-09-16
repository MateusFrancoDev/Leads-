/**
 * Fonte de empresas reais: OpenStreetMap via Overpass API.
 * Gratuita, sem chave de API e sem cartão.
 *
 *   segmento -> etiquetas OSM (category-mapper)
 *   cidade/UF -> área do município (Nominatim, com cache)
 *   Overpass -> elementos dentro da área -> LeadResult (normalizers/osm)
 *
 * Toda consulta é delimitada pela área do município, por etiquetas, por
 * quantidade (`out ... N`) e por timeout - nunca uma varredura aberta.
 */

import { AppError, userMessage } from "@/lib/errors";
import { mapCategory, BUSINESS_TAG_KEYS, labelFromTags, type CategoryRule, type OsmTagFilter } from "@/lib/leads/category-mapper";
import type { CityArea, NominatimGeocoder } from "@/lib/leads/geocoding/nominatim";
import { normalizeOsmElement } from "@/lib/leads/normalizers/osm";
import type { OverpassClient } from "@/lib/leads/providers/overpass-client";
import type { LeadProvider, LeadProviderResponse, LeadResult, LeadSearchParams } from "@/lib/leads/types";
import { cleanupText } from "@/lib/normalize";

/** Ids de área do Overpass derivam do id do elemento OSM. */
const AREA_ID_OFFSET = { relation: 3_600_000_000, way: 2_400_000_000 } as const;

export type OverpassSearchArea =
  | { kind: "area"; areaId: number }
  | { kind: "bbox"; south: number; west: number; north: number; east: number };

export function toSearchArea(area: CityArea): OverpassSearchArea {
  if (area.osmType === "relation" || area.osmType === "way") {
    return { kind: "area", areaId: AREA_ID_OFFSET[area.osmType] + Number(area.osmId) };
  }
  return { kind: "bbox", south: area.south, west: area.west, north: area.north, east: area.east };
}

/** Aspas e barras não podem quebrar a string da Overpass QL. */
function escapeQlString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

const ACCENT_CLASSES: Readonly<Record<string, string>> = {
  a: "[aáàâã]",
  e: "[eéèê]",
  i: "[iíì]",
  o: "[oóòôõ]",
  u: "[uúùü]",
  c: "[cç]",
};

/** "estetic" casa com "Estética": cada vogal aceita as versões acentuadas. */
export function toAccentInsensitivePattern(pattern: string): string {
  return pattern.replace(/[aeiouc]/g, (letter) => ACCENT_CLASSES[letter] ?? letter);
}

/** Termo livre do usuário vira padrão seguro: só letras, números e espaços. */
export function sanitizeNameTerm(term: string): string {
  return (cleanupText(term) ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function filterToSelector(filter: OsmTagFilter): string {
  let selector =
    filter.value === undefined
      ? `["${escapeQlString(filter.key)}"]`
      : `["${escapeQlString(filter.key)}"="${escapeQlString(filter.value)}"]`;
  if (filter.alsoRequires) {
    selector += `["${escapeQlString(filter.alsoRequires.key)}"="${escapeQlString(filter.alsoRequires.value)}"]`;
  }
  if (filter.nameMatches) {
    selector += `["name"~"${escapeQlString(toAccentInsensitivePattern(filter.nameMatches))}",i]`;
  }
  return selector;
}

export interface OverpassQueryInput {
  area: OverpassSearchArea;
  /** Nicho mapeado; null = busca pelo nome do estabelecimento. */
  rule: CategoryRule | null;
  term: string;
  limit: number;
  timeoutSeconds: number;
}

export function buildOverpassQuery({ area, rule, term, limit, timeoutSeconds }: OverpassQueryInput): string {
  const scope =
    area.kind === "area"
      ? "(area.searchArea)"
      : `(${area.south},${area.west},${area.north},${area.east})`;

  let selectors: string[];
  if (rule) {
    selectors = rule.filters.map(filterToSelector);
  } else {
    const name = sanitizeNameTerm(term);
    if (name.length < 2) {
      throw new AppError("INVALID_INPUT", "Informe um segmento com pelo menos 2 letras.");
    }
    const pattern = escapeQlString(toAccentInsensitivePattern(name));
    selectors = BUSINESS_TAG_KEYS.map((key) => `["${key}"]["name"~"${pattern}",i]`);
  }

  // ["name"] garante que só estabelecimentos identificáveis voltem.
  const statements = [...new Set(selectors)].map((selector) => `  nwr${selector}["name"]${scope};`);
  const header = `[out:json][timeout:${Math.max(5, Math.floor(timeoutSeconds))}];`;
  const areaLine = area.kind === "area" ? `area(id:${area.areaId})->.searchArea;\n` : "";
  const safeLimit = Math.max(1, Math.floor(limit));

  return `${header}\n${areaLine}(\n${statements.join("\n")}\n);\nout tags center ${safeLimit};`;
}

export interface OpenStreetMapProviderOptions {
  enabled: boolean;
  geocoder: Pick<NominatimGeocoder, "resolveCity">;
  overpass: Pick<OverpassClient, "run">;
  overpassTimeoutMs: number;
}

export class OpenStreetMapProvider implements LeadProvider {
  readonly name = "openstreetmap" as const;
  private readonly options: OpenStreetMapProviderOptions;

  constructor(options: OpenStreetMapProviderOptions) {
    this.options = options;
  }

  isEnabled(): boolean {
    return this.options.enabled;
  }

  async search(params: LeadSearchParams): Promise<LeadProviderResponse> {
    if (!this.options.enabled) throw new AppError("PROVIDER_NOT_CONFIGURED");

    const city = cleanupText(params.city);
    if (!city) {
      throw new AppError("INVALID_INPUT", "Informe a cidade: a busca é sempre limitada à área do município.");
    }

    const rule = mapCategory(params.query);
    const leads: LeadResult[] = [];
    const seen = new Set<string>();
    const warnings: string[] = [];
    let rawCount = 0;
    let requests = 0;

    // Uma consulta por cidade, em sequência: cada empresa fica com a cidade
    // certa (a do limite municipal em que foi encontrada) e o Overpass não
    // recebe rajadas.
    const cities = [city, ...params.extraCities];
    for (const [index, current] of cities.entries()) {
      try {
        const result = await this.searchCity(current, params, rule);
        requests += result.requests;
        rawCount += result.rawCount;
        for (const lead of result.leads) {
          if (!seen.has(lead.externalId)) {
            seen.add(lead.externalId);
            leads.push(lead);
          }
        }
      } catch (error) {
        // A cidade principal falhando é erro; uma vizinha falhando vira aviso.
        if (index === 0) throw error;
        warnings.push(`OpenStreetMap: não foi possível buscar em ${current} (${userMessage(error)})`);
      }
    }

    return { leads, rawCount, requests, sourceCounts: { openstreetmap: leads.length }, warnings };
  }

  private async searchCity(
    city: string,
    params: LeadSearchParams,
    rule: CategoryRule | null,
  ): Promise<{ leads: LeadResult[]; rawCount: number; requests: number }> {
    const { area, requests: geocodeRequests } = await this.options.geocoder.resolveCity(city, params.state);
    const searchArea = toSearchArea(area);

    const query = buildOverpassQuery({
      area: searchArea,
      rule,
      term: params.query,
      limit: params.limit,
      timeoutSeconds: this.options.overpassTimeoutMs / 1000,
    });
    const { elements, requests: overpassRequests } = await this.options.overpass.run(query);

    const leads = elements
      .map((element) =>
        normalizeOsmElement(element, {
          categoryLabel: rule?.label ?? (element.tags ? labelFromTags(element.tags) : null),
          area: { city: area.city, state: area.state, isMunicipalBoundary: searchArea.kind === "area" },
        }),
      )
      .filter((lead): lead is LeadResult => lead !== null);

    return { leads, rawCount: elements.length, requests: geocodeRequests + overpassRequests };
  }
}
