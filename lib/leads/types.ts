/**
 * Contratos da captação de leads.
 *
 * Regra que todo este módulo segue: só existe no resultado o que a fonte ou o
 * site oficial da empresa informou. Dado ausente é null - nunca completado,
 * deduzido ou gerado.
 */

/** Fontes de empresas reais e gratuitas. Novas fontes entram aqui. */
export const LEAD_SOURCES = ["openstreetmap", "receita_federal"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

/** De onde veio cada contato: de uma fonte de empresas ou do site oficial. */
export type ContactSource = LeadSource | "website";

/**
 * found       - a fonte (ou o site) informou um site próprio;
 * not_found   - ausência comprovada (nenhuma fonte desta versão comprova);
 * not_checked - a fonte não informou site, o que NÃO prova que ele não existe.
 */
export const WEBSITE_STATUSES = ["found", "not_found", "not_checked"] as const;
export type LeadWebsiteStatus = (typeof WEBSITE_STATUSES)[number];

/** confirmed = link wa.me/api.whatsapp.com ou etiqueta explícita; possible = só celular. */
export const WHATSAPP_STATUSES = ["confirmed", "possible", "unknown"] as const;
export type LeadWhatsappStatus = (typeof WHATSAPP_STATUSES)[number];

export const ENRICHMENT_STATUSES = ["pending", "completed", "partial", "failed"] as const;
export type LeadEnrichmentStatus = (typeof ENRICHMENT_STATUSES)[number];

export interface LeadSearchParams {
  /** Segmento como o usuário digitou (ex.: "barbearia"). */
  query: string;
  city: string;
  /** Sigla da UF (ex.: "SP"). */
  state: string;
  /** Cidades vizinhas da mesma UF incluídas na busca. */
  extraCities: readonly string[];
  /** Teto de estabelecimentos devolvidos pela fonte. */
  limit: number;
}

/** Etiquetas originais relevantes, guardadas para auditoria do lead. */
export type LeadRawData = Record<string, string | number | boolean | null | Record<string, string>>;

export interface LeadResult {
  /** Id real na fonte: "node/123" (OpenStreetMap) ou "cnpj/12345678000190" (Receita Federal). */
  externalId: string;
  source: LeadSource;

  name: string;
  category: string | null;

  address: string | null;
  street: string | null;
  number: string | null;
  neighborhood: string | null;

  city: string | null;
  state: string | null;
  postalCode: string | null;

  latitude: number | null;
  longitude: number | null;

  phone: string | null;
  /** Número só quando confirmado; um celular sozinho deixa este campo null. */
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  linkedin: string | null;

  osmUrl: string | null;

  websiteStatus: LeadWebsiteStatus;
  whatsappStatus: LeadWhatsappStatus;
  enrichmentStatus: LeadEnrichmentStatus;

  phoneSource: ContactSource | null;
  emailSource: ContactSource | null;
  websiteSource: ContactSource | null;
  instagramSource: ContactSource | null;
  whatsappSource: ContactSource | null;

  rawData: LeadRawData;

  score?: number;
}

export interface LeadProviderResponse {
  leads: LeadResult[];
  /** Elementos devolvidos pela fonte antes de descartar os inválidos. */
  rawCount: number;
  /** Requisições HTTP reais feitas (cache não conta). */
  requests: number;
  /** Resultados válidos por fonte. */
  sourceCounts: Partial<Record<LeadSource, number>>;
  /** Avisos para o usuário (fonte fora do ar, cidade não importada...). */
  warnings: string[];
}

export interface LeadProvider {
  /** Nome estável: entra na chave de cache e no registro de uso. */
  readonly name: string;
  /** false quando a fonte foi desligada na configuração. */
  isEnabled(): boolean;
  search(params: LeadSearchParams): Promise<LeadProviderResponse>;
}

/** Filtros aceitos pela busca (API e formulário). Ausente = indiferente. */
export interface LeadSearchFilters {
  hasPhone?: boolean;
  /** true = WhatsApp confirmado; false = nenhum sinal de WhatsApp. */
  hasWhatsapp?: boolean;
  hasInstagram?: boolean;
  hasEmail?: boolean;
  websiteStatus?: LeadWebsiteStatus;
  minScore?: number;
}
