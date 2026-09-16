/**
 * Constantes compartilhadas entre servidor e interface.
 * Nao le variaveis de ambiente - configuracao de runtime fica em server/config.ts.
 */

export const APP_CONFIG = {
  name: "Prospecta",
  description: "Prospeccao e captacao de leads B2B",

  /** Paginacao: nunca renderizar milhares de leads de uma vez. */
  pagination: {
    defaultPageSize: 20,
    loadMoreStep: 20,
    maxPageSize: 100,
  },

  /** Espera antes de disparar acoes a partir da digitacao. */
  debounceMs: 400,
} as const;
