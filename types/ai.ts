/**
 * Contrato da análise de oportunidade por IA.
 *
 * Como nos providers de leads, a aplicação fala com uma interface - trocar de
 * modelo ou de fornecedor não altera services, actions nem interface.
 */

/**
 * Entrada enviada ao modelo. E deliberadamente compacta: nunca o HTML do site,
 * nunca campos repetidos - apenas os sinais que sustentam a análise.
 */
export interface AiLeadInput {
  nome: string;
  ramo: string | null;
  cidade: string | null;
  estado: string | null;
  /** Situação do site no banco. NOT_PROVIDED = não informado na fonte, não "sem site". */
  situacaoDoSite: string;
  temTelefone: boolean;
  /** CONFIRMED, POSSIBLE (só celular) ou UNKNOWN. */
  situacaoDoWhatsapp: string;
  temEmail: boolean;
  temInstagram: boolean;
  leadScore: number;
  motivosDoScore: string[];
  /** Presente apenas quando o site já foi analisado. */
  site?: {
    titulo: string | null;
    descricao: string | null;
    problemas: string[];
  };
}

/** Resposta estruturada. O modelo nunca devolve texto livre solto. */
export interface AiOpportunityAnalysis {
  summary: string;
  problems: string[];
  opportunities: string[];
  services: string[];
  approach: string;
}

export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  /** Estimativa em dólares; null quando o preço do modelo não e conhecido. */
  costUsd: number | null;
}

export interface AiAnalysisResponse {
  analysis: AiOpportunityAnalysis;
  usage: AiUsage;
  model: string;
}

export interface AiProvider {
  readonly name: string;
  isConfigured(): boolean;
  analyzeOpportunity(input: AiLeadInput): Promise<AiAnalysisResponse>;
}

/** Análise já gravada, como a interface a consome. */
export interface StoredAiAnalysis extends AiOpportunityAnalysis {
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
  createdAt: Date;
  /** false quando os dados do lead mudaram desde a análise. */
  isCurrent: boolean;
}
