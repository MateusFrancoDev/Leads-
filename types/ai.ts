/**
 * Contrato da análise de oportunidade por IA.
 *
 * Como nos providers de leads, a aplicação fala com uma interface - trocar de
 * modelo ou de fornecedor (Gemini, Anthropic, outro) não altera services,
 * actions nem interface.
 *
 * Divisão de responsabilidades, que vale para o módulo inteiro:
 * o LEAD PROVIDER encontra empresas reais; o AI PROVIDER apenas classifica e
 * explica o que já foi encontrado. Nenhum campo de contato sai daqui.
 */

import type { ScoreLevel, WebsiteQuality } from "@/generated/prisma/enums";

export type { ScoreLevel, WebsiteQuality };

/** Alta, média ou baixa oportunidade - a mesma escala do lead score de regras. */
export type LeadOpportunity = ScoreLevel;

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
  temEnderecoCompleto: boolean;
  leadScore: number;
  motivosDoScore: string[];
  /** Avaliações públicas, só quando a fonte realmente as informou. */
  avaliacao?: { nota: number | null; quantidade: number | null };
  /** Presente apenas quando o site já foi baixado e analisado de verdade. */
  site?: {
    titulo: string | null;
    descricao: string | null;
    temHttps: boolean | null;
    temVersaoMobile: boolean | null;
    temFormulario: boolean | null;
    temWhatsapp: boolean | null;
    problemas: string[];
  };
}

/**
 * Resposta estruturada. O modelo nunca devolve texto livre solto.
 *
 * `hasWebsite` e `websiteQuality` NÃO vêm do modelo: são derivados do que o
 * banco sabe, justamente para o modelo não poder afirmar nada sobre um site
 * que ninguém abriu (ver server/services/lead-ai-service.ts).
 */
export interface AiOpportunityAnalysis {
  /** 0 a 100. */
  score: number;
  opportunity: LeadOpportunity;
  /** Uma frase explicando a nota. */
  scoreReason: string;
  summary: string;
  problems: string[];
  opportunities: string[];
  /** Serviços que podemos oferecer (recommendedServices). */
  services: string[];
  /** Sugestão de abordagem comercial (salesApproach). */
  approach: string;
  /** 0 a 1. */
  confidence: number;
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
  provider: string;
  model: string;
  /** Derivado do banco, nunca do modelo. */
  hasWebsite: boolean;
  websiteQuality: WebsiteQuality;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
  createdAt: Date;
  /** false quando os dados do lead mudaram desde a análise. */
  isCurrent: boolean;
}
