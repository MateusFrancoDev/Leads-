/**
 * Configuração central do Lead Score (0 a 100).
 * Todo peso e limiar vive aqui - nenhum número mágico espalhado pelo código.
 * Ajustar estes valores muda o ranking inteiro sem tocar na lógica.
 *
 * O perfil priorizado é o de quem pode precisar de site, landing page ou
 * automação: empresa real, com endereço e contato, presença em rede social e
 * sem site conhecido.
 */

export const LEAD_SCORE_CONFIG = {
  maxScore: 100,

  /** Faixas de oportunidade: score >= limiar define o nível. */
  levels: {
    high: 70,
    medium: 40,
  },

  /** Pontos por sinal encontrado. */
  weights: {
    /** Ausência de site comprovada. Nenhuma fonte desta versão comprova, mas o peso fica pronto. */
    websiteConfirmedMissing: 30,
    /**
     * A fonte foi consultada e não informou site. Vale menos que a ausência
     * comprovada: a empresa pode ter um site que só não está no mapa.
     */
    websiteNotProvided: 20,
    /** Site cadastrado que não respondeu à análise. */
    websiteUnreachable: 20,
    /** Endereço de site inválido na fonte. */
    websiteInvalid: 10,
    /** Site sem HTTPS (visto na análise de site). */
    websiteWithoutHttps: 10,
    phone: 15,
    confirmedWhatsapp: 15,
    possibleWhatsapp: 5,
    instagram: 10,
    email: 10,
    /** Rua, número e cidade: presença física verificável. */
    fullAddress: 5,
    /** Tem Instagram/Facebook mas nenhum site conhecido - o perfil mais interessante. */
    socialPresenceWithoutWebsite: 15,
  },
} as const;

export type LeadScoreWeightKey = keyof typeof LEAD_SCORE_CONFIG.weights;
