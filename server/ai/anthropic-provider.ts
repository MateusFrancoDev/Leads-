/**
 * Análise de oportunidade com a API da Anthropic.
 *
 * Economia de tokens, por construcao:
 * - a entrada e um JSON compacto montado pelo serviço - nunca HTML de site;
 * - a saída e estruturada (Zod + output_config.format), então não há texto
 *   solto para reprocessar nem parsing frágil;
 * - o esforço (`effort`) e configurável e vem baixo por padrão, porque
 *   analisar um lead e uma tarefa pequena;
 * - quem decide se vale gastar e o serviço, comparando o hash da entrada.
 */

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";
import { estimateCostUsd, serverConfig } from "@/server/config";
import type { AiAnalysisResponse, AiLeadInput, AiProvider } from "@/types/ai";

const logger = createLogger("ai-anthropic");

const analysisSchema = z.object({
  summary: z.string().describe("Resumo em uma frase da oportunidade comercial"),
  problems: z.array(z.string()).describe("Problemas concretos identificados"),
  opportunities: z.array(z.string()).describe("Oportunidades de melhoria para a empresa"),
  services: z.array(z.string()).describe("Serviços que poderiamos oferecer a ela"),
  approach: z.string().describe("Sugestão de abordagem comercial, em 2 a 3 frases"),
});

const SYSTEM_PROMPT = [
  "Você analisa empresas para uma agência que vende presença digital",
  "(sites, landing pages, SEO local, tráfego pago e automação de atendimento).",
  "",
  "Recebe um JSON com os dados publicos de uma empresa e responde em português",
  "do Brasil, de forma objetiva e verificável.",
  "",
  "Regras:",
  "- baseie-se apenas nos dados recebidos; não invente fatos, números ou nomes;",
  "- quando um dado estiver ausente, trate como desconhecido, não como problema;",
  "- de 2 a 5 itens por lista, cada um em uma frase curta;",
  "- a abordagem comercial deve citar algo específico da empresa;",
  "- nada de promessas de resultado nem linguagem de venda agressiva.",
].join("\n");

export class AnthropicAiProvider implements AiProvider {
  readonly name = "anthropic";

  private readonly client: Anthropic | null;

  constructor(apiKey: string = serverConfig.ai.apiKey) {
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async analyzeOpportunity(input: AiLeadInput): Promise<AiAnalysisResponse> {
    if (!this.client) throw new AppError("PROVIDER_NOT_CONFIGURED");
    const model = serverConfig.ai.model;

    try {
      const response = await this.client.beta.messages.parse({
        model,
        max_tokens: serverConfig.ai.maxOutputTokens,
        // Fallback do lado do servidor: se o modelo recusar por política, a
        // própria chamada e reexecutada em um modelo alternativo.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: SYSTEM_PROMPT,
        output_config: {
          effort: serverConfig.ai.effort,
          format: zodOutputFormat(analysisSchema),
        },
        messages: [{ role: "user", content: JSON.stringify(input) }],
      });

      if (response.stop_reason === "refusal") {
        logger.warn("análise recusada pelo modelo");
        throw new AppError("PROVIDER_ERROR", "O modelo não pode analisar esta empresa.");
      }

      const analysis = response.parsed_output;
      if (!analysis) {
        throw new AppError("PROVIDER_ERROR", "A resposta da IA veio em formato inesperado.");
      }

      const inputTokens = response.usage.input_tokens;
      const outputTokens = response.usage.output_tokens;
      const cachedInputTokens = response.usage.cache_read_input_tokens ?? 0;

      logger.info("análise gerada", { model, inputTokens, outputTokens });

      return {
        analysis,
        model: response.model ?? model,
        usage: {
          inputTokens,
          outputTokens,
          cachedInputTokens,
          costUsd: estimateCostUsd(model, inputTokens, outputTokens),
        },
      };
    } catch (error) {
      throw toAppError(error);
    }
  }
}

/** Erros do SDK viram códigos que a interface sabe explicar. */
function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof Anthropic.AuthenticationError) {
    return new AppError("PROVIDER_NOT_CONFIGURED", undefined, error);
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new AppError("PROVIDER_RATE_LIMITED", undefined, error);
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new AppError("NETWORK_ERROR", undefined, error);
  }
  if (error instanceof Anthropic.APIError) {
    const retryable = typeof error.status === "number" && error.status >= 500;
    return new AppError(retryable ? "PROVIDER_UNAVAILABLE" : "PROVIDER_ERROR", undefined, error);
  }
  return new AppError("UNKNOWN", undefined, error);
}
