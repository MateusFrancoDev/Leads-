/**
 * Constantes compartilhadas entre servidor e interface.
 * Não lê variáveis de ambiente - configuração de runtime fica em server/config.ts.
 */

export const APP_CONFIG = {
  name: "Lummit",
  description: "Sistema interno da empresa",

  /** Aparece no topo da tela de login. */
  loginTitle: "Entrar na Lummit",

  /** Paginação: nunca renderizar milhares de leads de uma vez. */
  pagination: {
    defaultPageSize: 20,
    loadMoreStep: 20,
    maxPageSize: 100,
  },

  /** Espera antes de disparar ações a partir da digitação. */
  debounceMs: 400,
} as const;
