/**
 * Contrato dos provedores de dados de empresas.
 *
 * A aplicacao nunca fala com uma API especifica: fala com LeadProvider.
 * Trocar Google Places por outra fonte e trocar a implementacao, nada mais.
 */

export interface ProviderSearchParams {
  /** Nicho + palavra-chave ja combinados (ex.: "clinica de estetica"). */
  term: string;
  city: string | null;
  state: string | null;
  neighborhood: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number | null;
  /** Teto de resultados. O provider deve parar de paginar ao atingi-lo. */
  limit: number;
}

/** Dados basicos: e tudo que buscamos na etapa de descoberta (barata). */
export interface ProviderBusiness {
  externalId: string;
  name: string;
  category: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  reviewsCount: number | null;
}

/** Dados extras, buscados so quando o usuario demonstra interesse. */
export interface ProviderBusinessDetails extends ProviderBusiness {
  email: string | null;
  /** URLs de redes sociais encontradas; a classificacao acontece no servico. */
  socialLinks: string[];
}

/** Toda resposta informa quantas chamadas externas custou (metricas de custo). */
export interface ProviderResponse<T> {
  data: T;
  requests: number;
}

export interface LeadProvider {
  /** Identificador persistido em Lead.provider e Search.provider. */
  readonly name: string;
  /** false quando falta chave/configuracao - evita chamada fadada a erro. */
  isConfigured(): boolean;
  searchBusinesses(params: ProviderSearchParams): Promise<ProviderResponse<ProviderBusiness[]>>;
  getBusinessDetails(externalId: string): Promise<ProviderResponse<ProviderBusinessDetails | null>>;
}
