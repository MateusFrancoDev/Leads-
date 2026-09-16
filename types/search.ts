/** Tipos da pesquisa: histórico exibido na interface. */

/** Linha da tela de histórico. */
export interface SearchHistoryItem {
  id: string;
  term: string;
  city: string | null;
  state: string | null;
  extraCities: string[];
  provider: string;
  /** Resultados por fonte na última execução. */
  sourceCounts: Partial<Record<"openstreetmap" | "receita_federal", number>>;
  /** Avisos das fontes (cidade não importada, fonte fora do ar). */
  warnings: string[];
  resultsCount: number;
  requestCount: number;
  runCount: number;
  cacheHits: number;
  lastRunAt: Date;
  expiresAt: Date;
  /** Se o cache ainda vale. Calculado na camada de dados, não na renderização. */
  isCacheFresh: boolean;
}
