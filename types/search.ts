/** Tipos da pesquisa: entrada normalizada, historico e resultado da execucao. */

/** Pesquisa ja normalizada (cidade/UF padronizadas). Base da chave de cache. */
export interface NormalizedSearch {
  term: string;
  keyword: string | null;
  city: string | null;
  state: string | null;
  neighborhood: string | null;
  country: string | null;
  radiusMeters: number | null;
  latitude: number | null;
  longitude: number | null;
}

/** Linha da tela de historico. */
export interface SearchHistoryItem {
  id: string;
  term: string;
  keyword: string | null;
  city: string | null;
  state: string | null;
  neighborhood: string | null;
  radiusMeters: number | null;
  provider: string;
  resultsCount: number;
  requestCount: number;
  runCount: number;
  cacheHits: number;
  lastRunAt: Date;
  expiresAt: Date;
  /** Se o cache ainda vale. Calculado na camada de dados, nao na renderizacao. */
  isCacheFresh: boolean;
}

/** De onde vieram os resultados - usado para mostrar economia de API. */
export type SearchSource = "cache" | "provider";

export interface SearchExecution {
  searchId: string;
  source: SearchSource;
  total: number;
  newLeads: number;
  providerRequests: number;
}
