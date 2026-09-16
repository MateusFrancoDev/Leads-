/**
 * Fonte de empresas reais: Dados Abertos do CNPJ da Receita Federal.
 * Gratuita, pública e sem chave de API.
 *
 * A consulta é feita na cópia local (tabela CnpjEstablishment), preenchida por
 * `npm run cnpj:import` com as empresas ATIVAS das cidades escolhidas. Nada é
 * baixado durante a busca.
 *
 * O cadastro traz nome, CNAE, endereço e - quando a empresa declarou -
 * telefone e e-mail. Não traz site, redes sociais nem coordenadas: esses
 * campos ficam null.
 */

import { mapCategory, type CnaeFilter } from "@/lib/leads/category-mapper";
import { cleanCompanyName, formatCnpj, type CnpjEstablishmentRecord } from "@/lib/cnpj/records";
import type { LeadProvider, LeadProviderResponse, LeadResult, LeadSearchParams } from "@/lib/leads/types";
import {
  type BrazilianPhone,
  normalizeBrazilianPhone,
  normalizeCity,
  normalizeEmail,
  normalizeForComparison,
  normalizePostalCode,
  normalizeState,
} from "@/lib/normalize";

export interface CnpjSearchQuery {
  state: string;
  /** Nomes das cidades como estão na Receita (ex.: "OSASCO"). */
  cityNames: readonly string[];
  /** Atividades do nicho; null = busca pelo nome. */
  cnaes: readonly CnaeFilter[] | null;
  nameTerm: string | null;
  limit: number;
}

export interface CnpjImportedCityInfo {
  /** Cidade + UF normalizadas (ver buildCnpjCityKey). */
  key: string;
  cityName: string;
  datasetMonth: string;
}

export interface CnpjStore {
  findImportedCities(keys: readonly string[]): Promise<CnpjImportedCityInfo[]>;
  search(query: CnpjSearchQuery): Promise<CnpjEstablishmentRecord[]>;
}

/** Chave da cidade importada: "SP|osasco". Mesma regra no import e na busca. */
export function buildCnpjCityKey(state: string, city: string): string {
  return `${state.toUpperCase()}|${normalizeForComparison(city)}`;
}

/** Nomes da Receita vêm em maiúsculas: só a caixa muda na exibição. */
function displayName(value: string | null): string | null {
  return value ? normalizeCity(value) : null;
}

const NO_NUMBER = /^(s\/?n|sn|s\.n\.?|sem numero|0+)$/i;

export function cnpjRecordToLead(
  record: CnpjEstablishmentRecord,
  context: { categoryLabel: string | null; requestedCities: readonly string[] },
): LeadResult | null {
  const name = displayName(record.tradeName) ?? displayName(cleanCompanyName(record.companyName));
  if (!name) return null;

  const street = displayName([record.streetType, record.street].filter(Boolean).join(" ") || null);
  const number = record.number && !NO_NUMBER.test(record.number) ? record.number : null;
  const address = street ? (number ? `${street}, ${number}` : street) : null;

  const phones = [record.phone1, record.phone2]
    .map((value) => normalizeBrazilianPhone(value))
    .filter((phone): phone is BrazilianPhone => phone !== null);
  const phone = phones[0]?.digits ?? null;
  const email = normalizeEmail(record.email);

  // Mesma grafia da cidade pedida pelo usuário, quando é a mesma cidade.
  const recordCity = normalizeForComparison(record.cityName);
  const city =
    context.requestedCities.find((requested) => normalizeForComparison(requested) === recordCity) ??
    displayName(record.cityName);

  const startDate = record.startDate
    ? `${record.startDate.slice(0, 4)}-${record.startDate.slice(4, 6)}-${record.startDate.slice(6, 8)}`
    : null;

  return {
    externalId: `cnpj/${record.cnpj}`,
    source: "receita_federal",
    name,
    category: context.categoryLabel,
    address,
    street,
    number,
    neighborhood: displayName(record.neighborhood),
    city,
    state: normalizeState(record.state),
    postalCode: normalizePostalCode(record.postalCode),
    // O cadastro não tem coordenadas, e geocodificar cada empresa não é permitido.
    latitude: null,
    longitude: null,
    phone,
    whatsapp: null,
    email,
    website: null,
    instagram: null,
    facebook: null,
    linkedin: null,
    osmUrl: null,
    websiteStatus: "not_checked",
    whatsappStatus: phones.some((item) => item.isMobile) ? "possible" : "unknown",
    enrichmentStatus: "completed",
    phoneSource: phone ? "receita_federal" : null,
    emailSource: email ? "receita_federal" : null,
    websiteSource: null,
    instagramSource: null,
    whatsappSource: phones.some((item) => item.isMobile) ? "receita_federal" : null,
    rawData: {
      cnpj: formatCnpj(record.cnpj),
      razaoSocial: cleanCompanyName(record.companyName),
      nomeFantasia: record.tradeName,
      cnae: record.cnaeMain,
      matriz: record.isHeadquarters,
      inicioAtividade: startDate,
      complemento: record.complement,
      baseDeDados: record.datasetMonth,
    },
  };
}

/** Termo livre para busca por nome: sem acento e com pelo menos 3 letras. */
function nameSearchTerm(query: string): string | null {
  const term = normalizeForComparison(query);
  return term.length >= 3 ? term : null;
}

export interface ReceitaFederalProviderOptions {
  enabled: boolean;
  store: CnpjStore;
}

export class ReceitaFederalProvider implements LeadProvider {
  readonly name = "receita_federal" as const;
  private readonly options: ReceitaFederalProviderOptions;

  constructor(options: ReceitaFederalProviderOptions) {
    this.options = options;
  }

  isEnabled(): boolean {
    return this.options.enabled;
  }

  async search(params: LeadSearchParams): Promise<LeadProviderResponse> {
    const empty = (warnings: string[]): LeadProviderResponse => ({
      leads: [],
      rawCount: 0,
      requests: 0,
      sourceCounts: { receita_federal: 0 },
      warnings,
    });

    const state = normalizeState(params.state);
    if (!state) return empty([]);

    const requestedCities = [params.city, ...params.extraCities];
    const keys = requestedCities.map((city) => buildCnpjCityKey(state, city));
    const imported = await this.options.store.findImportedCities(keys);
    const importedKeys = new Set(imported.map((item) => item.key));
    const missing = requestedCities.filter((city) => !importedKeys.has(buildCnpjCityKey(state, city)));

    const warnings: string[] = [];
    if (missing.length > 0) {
      const list = missing.join(", ");
      warnings.push(
        `Receita Federal: ${list}/${state} ainda não foi importada. ` +
          `Rode: npm run cnpj:import -- --uf ${state} --cidades "${list}"`,
      );
    }
    if (imported.length === 0) return empty(warnings);

    const rule = mapCategory(params.query);
    const nameTerm = rule ? null : nameSearchTerm(params.query);
    if (!rule && !nameTerm) return empty(warnings);

    const records = await this.options.store.search({
      state,
      cityNames: imported.map((item) => item.cityName),
      cnaes: rule?.cnaes ?? null,
      nameTerm,
      limit: params.limit,
    });

    const leads = records
      .map((record) => cnpjRecordToLead(record, { categoryLabel: rule?.label ?? null, requestedCities }))
      .filter((lead): lead is LeadResult => lead !== null);

    return {
      leads,
      rawCount: records.length,
      // Consulta local: nenhuma requisição externa.
      requests: 0,
      sourceCounts: { receita_federal: leads.length },
      warnings,
    };
  }
}
