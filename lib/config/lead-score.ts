/**
 * Configuracao central do Lead Score (0 a 100).
 * Todo peso e limiar vive aqui - nenhum numero magico espalhado pelo codigo.
 * Ajustar estes valores muda o ranking inteiro sem tocar na logica.
 */

export const LEAD_SCORE_CONFIG = {
  maxScore: 100,

  /** Faixas de oportunidade: score >= limiar define o nivel. */
  levels: {
    high: 70,
    medium: 40,
  },

  /** Pontos por sinal encontrado. */
  weights: {
    /** Nao possui site proprio - a maior oportunidade do produto. */
    noWebsite: 30,
    /** Site existe mas esta fora do ar ou quebrado. */
    brokenWebsite: 20,
    /** So tem rede social no lugar do site. */
    socialOnly: 25,
    /** Site sem HTTPS (avaliado na Fase 2). */
    websiteWithoutHttps: 10,
    hasPhone: 15,
    hasWhatsapp: 10,
    hasInstagram: 8,
    hasEmail: 10,
    goodRating: 10,
    manyReviews: 7,
    veryManyReviews: 5,
  },

  /** Limiares usados pelos pesos acima. */
  thresholds: {
    goodRating: 4,
    manyReviews: 20,
    veryManyReviews: 100,
  },
} as const;

export type LeadScoreWeightKey = keyof typeof LEAD_SCORE_CONFIG.weights;
