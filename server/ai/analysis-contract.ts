/**
 * Contrato único da análise: prompt, schema de validação e schema de saída
 * estruturada. Todos os providers usam este arquivo - trocar de modelo não
 * pode mudar o formato da resposta nem as regras contra invenção de dados.
 *
 * A resposta do modelo NUNCA é usada direto: passa por `parseAnalysis`, que
 * valida com Zod e corta listas e textos longos demais.
 */

import { z } from "zod";
import { AppError } from "@/lib/errors";
import { ScoreLevel } from "@/generated/prisma/enums";
import type { AiOpportunityAnalysis, LeadOpportunity } from "@/types/ai";

/**
 * Muda sempre que o formato da análise mudar. Entra no hash da entrada, então
 * análises gravadas no formato antigo não são reaproveitadas por engano.
 */
export const ANALYSIS_CONTRACT_VERSION = 2;

/** Tetos aplicados na saída: resposta curta é resposta barata. */
const LIMITS = {
  maxItems: 5,
  maxItemChars: 160,
  maxSummaryChars: 400,
  maxApproachChars: 600,
} as const;

const OPPORTUNITY_VALUES = ["high", "medium", "low"] as const;

const shortText = z.string().trim().max(LIMITS.maxItemChars * 2);

const list = z
  .array(shortText)
  .max(20)
  .transform((items) =>
    items
      .map((item) => item.slice(0, LIMITS.maxItemChars).trim())
      .filter((item) => item.length > 0)
      .slice(0, LIMITS.maxItems),
  );

/**
 * O que aceitamos do modelo. Tolerante onde não importa (número fora da faixa
 * é aparado, lista longa é cortada) e rígido onde importa (score e confiança
 * precisam ser números; oportunidade precisa ser um dos três valores).
 */
export const modelAnalysisSchema = z.object({
  score: z.coerce.number().min(0).max(100).transform((value) => Math.round(value)),
  opportunity: z.enum(OPPORTUNITY_VALUES).optional(),
  scoreReason: shortText.max(LIMITS.maxSummaryChars),
  summary: shortText.max(LIMITS.maxSummaryChars),
  problems: list,
  opportunities: list,
  recommendedServices: list,
  salesApproach: z.string().trim().max(LIMITS.maxApproachChars * 2),
  confidence: z.coerce.number().min(0).max(1),
});

/**
 * Mesmo contrato, sem `coerce` nem `transform`: é o que os SDKs convertem em
 * JSON Schema de saída estruturada. O schema tolerante acima continua sendo
 * quem valida a resposta - este só descreve o formato pedido ao modelo.
 */
export const structuredOutputSchema = z.object({
  score: z.number().int().min(0).max(100).describe("Potencial comercial de 0 a 100"),
  opportunity: z.enum(OPPORTUNITY_VALUES).describe("Faixa da nota"),
  scoreReason: z.string().describe("Uma frase justificando a nota"),
  summary: z.string().describe("Resumo da oportunidade em uma ou duas frases"),
  problems: z.array(z.string()).describe("Problemas sustentados pelos dados recebidos"),
  opportunities: z.array(z.string()).describe("Oportunidades de melhoria para a empresa"),
  recommendedServices: z.array(z.string()).describe("Serviços que podemos oferecer a ela"),
  salesApproach: z.string().describe("Abordagem comercial em 2 a 3 frases"),
  confidence: z.number().min(0).max(1).describe("Confiança na análise, de 0 a 1"),
});

/** Faixa derivada do score. Nunca deixamos badge e número se contradizerem. */
export function opportunityFromScore(score: number): LeadOpportunity {
  if (score >= 70) return ScoreLevel.HIGH;
  if (score >= 40) return ScoreLevel.MEDIUM;
  return ScoreLevel.LOW;
}

const OPPORTUNITY_BY_VALUE: Record<(typeof OPPORTUNITY_VALUES)[number], LeadOpportunity> = {
  high: ScoreLevel.HIGH,
  medium: ScoreLevel.MEDIUM,
  low: ScoreLevel.LOW,
};

/**
 * Valida a resposta e devolve o formato interno.
 *
 * A faixa vem do score, não do rótulo que o modelo escreveu: o número é o dado
 * que a interface ordena e filtra, então ele manda. O rótulo do modelo só é
 * usado quando ele não contradiz o score.
 */
export function parseAnalysis(raw: unknown): AiOpportunityAnalysis {
  const parsed = modelAnalysisSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError("PROVIDER_ERROR", "A resposta da IA veio em formato inesperado.");
  }
  const data = parsed.data;
  const fromScore = opportunityFromScore(data.score);
  const declared = data.opportunity ? OPPORTUNITY_BY_VALUE[data.opportunity] : undefined;

  return {
    score: data.score,
    opportunity: declared === fromScore ? declared : fromScore,
    scoreReason: data.scoreReason,
    summary: data.summary,
    problems: data.problems,
    opportunities: data.opportunities,
    services: data.recommendedServices,
    approach: data.salesApproach.slice(0, LIMITS.maxApproachChars).trim(),
    confidence: data.confidence,
  };
}

/**
 * Instruções do sistema. A regra contra invenção vem primeiro porque é a mais
 * importante: o lead é dado real coletado de fonte pública, e a IA só pode
 * raciocinar sobre o que recebeu.
 */
export const SYSTEM_PROMPT = [
  "Você qualifica empresas para uma agência que vende presença digital",
  "(sites, landing pages, SEO local, tráfego pago e automação de atendimento).",
  "",
  "REGRA MAIS IMPORTANTE - você analisa exclusivamente os dados do JSON recebido.",
  "NUNCA invente telefone, e-mail, endereço, site, redes sociais, avaliações,",
  "número de funcionários, faturamento, história ou qualquer outro fato sobre a",
  "empresa. Você não cria dados de lead: você apenas classifica e explica os que",
  "recebeu. Se um dado não veio, trate-o como desconhecido e diga isso - nunca",
  "preencha a lacuna com suposição apresentada como fato.",
  "",
  "Não afirme que o site tem um problema sem um sinal no JSON que sustente isso.",
  "Quando o objeto `site` não vier, o site não foi verificado: não opine sobre",
  "design, velocidade, responsividade nem SEO dele.",
  "",
  "Como pontuar (score de 0 a 100) - é o potencial comercial PARA A AGÊNCIA:",
  "- empresa ativa, com telefone e endereço, mas sem site conhecido, é uma",
  "  oportunidade ALTA: dá para vender a criação do site;",
  "- site existente com problemas verificados também é oportunidade alta;",
  "- site existente e aparentemente bem resolvido reduz a oportunidade;",
  "- falta de canal de contato reduz a oportunidade, porque não há como abordar;",
  "- avaliações boas e movimento real reforçam que a empresa pode pagar.",
  "Nunca chute um número redondo genérico: a nota tem que sair dos sinais.",
  "",
  "`confidence` é a sua confiança na análise: poucos dados = confiança baixa.",
  "",
  "Formato: responda em português do Brasil, objetivo e verificável.",
  "De 2 a 5 itens por lista, cada um em uma frase curta. `scoreReason` explica a",
  "nota em uma frase. `salesApproach` cita algo específico desta empresa, em 2 a",
  "3 frases. Nada de promessa de resultado nem venda agressiva.",
].join("\n");

/**
 * Schema de saída estruturada no formato OpenAPI que o Gemini espera
 * (`generationConfig.responseSchema`). Escrito à mão e de propósito: é o mesmo
 * contrato do Zod acima, e manter os dois lado a lado evita uma dependência só
 * para converter um do outro.
 */
export const GEMINI_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    score: { type: "INTEGER", description: "Potencial comercial de 0 a 100" },
    opportunity: { type: "STRING", enum: [...OPPORTUNITY_VALUES] },
    scoreReason: { type: "STRING", description: "Uma frase justificando a nota" },
    summary: { type: "STRING", description: "Resumo da oportunidade em uma ou duas frases" },
    problems: {
      type: "ARRAY",
      description: "Problemas sustentados pelos dados recebidos",
      items: { type: "STRING" },
    },
    opportunities: {
      type: "ARRAY",
      description: "Oportunidades de melhoria para a empresa",
      items: { type: "STRING" },
    },
    recommendedServices: {
      type: "ARRAY",
      description: "Serviços que a agência pode oferecer a esta empresa",
      items: { type: "STRING" },
    },
    salesApproach: { type: "STRING", description: "Abordagem comercial em 2 a 3 frases" },
    confidence: { type: "NUMBER", description: "Confiança na análise, de 0 a 1" },
  },
  required: [
    "score",
    "opportunity",
    "scoreReason",
    "summary",
    "problems",
    "opportunities",
    "recommendedServices",
    "salesApproach",
    "confidence",
  ],
  propertyOrdering: [
    "score",
    "opportunity",
    "scoreReason",
    "summary",
    "problems",
    "opportunities",
    "recommendedServices",
    "salesApproach",
    "confidence",
  ],
} as const;
