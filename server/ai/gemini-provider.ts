/**
 * Análise de oportunidade com a API oficial do Google (Gemini).
 *
 * Usa a API REST direto com `fetch`: a chamada é um único POST com resposta
 * estruturada, então o SDK não acrescentaria nada que justificasse mais uma
 * dependência no projeto.
 *
 * Economia de tokens, por construção:
 * - a entrada é um JSON compacto montado pelo serviço - nunca HTML de site;
 * - a saída é estruturada (responseSchema + responseMimeType), então não há
 *   texto solto para reprocessar nem parsing frágil;
 * - `thinkingBudget` vem 0: em Gemini 2.5 o raciocínio é cobrado como saída e
 *   qualificar um lead é tarefa simples;
 * - temperatura baixa e teto de tokens de saída;
 * - quem decide se vale gastar é o serviço, comparando o hash da entrada.
 *
 * A chave vive só aqui, no servidor: nunca entra em resposta de rota, em log
 * nem em mensagem de erro exibida ao usuário.
 */

import { AppError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";
import { estimateCostUsd, serverConfig } from "@/server/config";
import {
  GEMINI_RESPONSE_SCHEMA,
  SYSTEM_PROMPT,
  parseAnalysis,
} from "@/server/ai/analysis-contract";
import type { AiAnalysisResponse, AiLeadInput, AiProvider } from "@/types/ai";

const logger = createLogger("ai-gemini");

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/** Só os campos da resposta que realmente lemos. */
interface GeminiResponse {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
    cachedContentTokenCount?: number;
  };
  modelVersion?: string;
  error?: { code?: number; message?: string; status?: string };
}

export class GeminiAiProvider implements AiProvider {
  readonly name = "gemini";

  private readonly apiKey: string;

  constructor(apiKey: string = serverConfig.ai.apiKey) {
    this.apiKey = apiKey.trim();
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0 && serverConfig.ai.model.length > 0;
  }

  async analyzeOpportunity(input: AiLeadInput): Promise<AiAnalysisResponse> {
    if (!this.isConfigured()) throw new AppError("PROVIDER_NOT_CONFIGURED");
    const model = serverConfig.ai.model;

    const body = {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: JSON.stringify(input) }] }],
      generationConfig: {
        temperature: serverConfig.ai.temperature,
        maxOutputTokens: serverConfig.ai.maxOutputTokens,
        responseMimeType: "application/json",
        responseSchema: GEMINI_RESPONSE_SCHEMA,
        thinkingConfig: { thinkingBudget: serverConfig.ai.thinkingBudget },
      },
    };

    const payload = await this.request(model, body);

    const blockReason = payload.promptFeedback?.blockReason;
    if (blockReason) {
      logger.warn("análise bloqueada pelo modelo", { blockReason });
      throw new AppError("PROVIDER_ERROR", "O modelo não pôde analisar esta empresa.");
    }

    const candidate = payload.candidates?.[0];
    const finishReason = candidate?.finishReason;
    if (finishReason === "MAX_TOKENS") {
      logger.warn("resposta truncada", { model });
      throw new AppError(
        "PROVIDER_ERROR",
        "A resposta da IA foi cortada. Aumente AI_MAX_OUTPUT_TOKENS e tente de novo.",
      );
    }
    if (finishReason && finishReason !== "STOP") {
      logger.warn("análise interrompida", { finishReason });
      throw new AppError("PROVIDER_ERROR", "O modelo não pôde analisar esta empresa.");
    }

    const text = (candidate?.content?.parts ?? [])
      .map((part) => part.text ?? "")
      .join("")
      .trim();
    if (!text) throw new AppError("PROVIDER_ERROR", "A IA respondeu sem conteúdo.");

    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      logger.warn("JSON inválido na resposta", { model });
      throw new AppError("PROVIDER_ERROR", "A resposta da IA veio em formato inesperado.");
    }

    // Nunca confiamos no JSON do modelo: Zod valida e apara antes de gravar.
    const analysis = parseAnalysis(raw);

    const usage = payload.usageMetadata ?? {};
    const inputTokens = usage.promptTokenCount ?? 0;
    // O raciocínio é cobrado como saída; somar mantém a estimativa honesta.
    const outputTokens = (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0);

    logger.info("análise gerada", { model, inputTokens, outputTokens });

    return {
      analysis,
      model: payload.modelVersion ?? model,
      usage: {
        inputTokens,
        outputTokens,
        cachedInputTokens: usage.cachedContentTokenCount ?? 0,
        costUsd: estimateCostUsd(model, inputTokens, outputTokens),
      },
    };
  }

  /** Uma chamada HTTP, com timeout e erros já traduzidos em AppError. */
  private async request(model: string, body: unknown): Promise<GeminiResponse> {
    // O modelo vai na URL: encodeURIComponent impede que um valor estranho no
    // .env vire outro caminho na API.
    const url = `${API_BASE}/${encodeURIComponent(model)}:generateContent`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": this.apiKey,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(serverConfig.ai.timeoutMs),
        cache: "no-store",
      });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "TimeoutError";
      logger.error(timedOut ? "timeout na chamada" : "falha de rede na chamada");
      throw new AppError(
        "NETWORK_ERROR",
        timedOut ? "A IA demorou demais para responder. Tente de novo." : undefined,
        error,
      );
    }

    let payload: GeminiResponse;
    try {
      payload = (await response.json()) as GeminiResponse;
    } catch (error) {
      if (!response.ok) throw statusToAppError(response.status, undefined, error);
      throw new AppError("PROVIDER_ERROR", "A resposta da IA veio em formato inesperado.", error);
    }

    if (!response.ok || payload.error) {
      // A mensagem do Google pode conter detalhe técnico: fica no log do
      // servidor, e o usuário recebe a mensagem padrão do código.
      logger.error("erro na API do Gemini", {
        status: response.status,
        code: payload.error?.status,
      });
      throw statusToAppError(response.status, payload.error?.status);
    }

    return payload;
  }
}

/** Códigos HTTP/status do Google traduzidos no vocabulário de erro do projeto. */
function statusToAppError(status: number, googleStatus?: string, cause?: unknown): AppError {
  if (status === 401 || status === 403 || googleStatus === "PERMISSION_DENIED") {
    return new AppError(
      "PROVIDER_NOT_CONFIGURED",
      "A chave do Gemini foi recusada. Confira GEMINI_API_KEY no .env.",
      cause,
    );
  }
  if (status === 429 || googleStatus === "RESOURCE_EXHAUSTED") {
    return new AppError(
      "PROVIDER_RATE_LIMITED",
      "Limite de uso da IA atingido. Aguarde alguns minutos.",
      cause,
    );
  }
  if (status === 404 || googleStatus === "NOT_FOUND") {
    return new AppError(
      "PROVIDER_UNAVAILABLE",
      `Modelo "${serverConfig.ai.model}" indisponível. Confira AI_MODEL no .env.`,
      cause,
    );
  }
  if (status === 400 && googleStatus === "INVALID_ARGUMENT") {
    return new AppError(
      "PROVIDER_NOT_CONFIGURED",
      "A API do Gemini recusou a requisição. Confira GEMINI_API_KEY e AI_MODEL no .env.",
      cause,
    );
  }
  if (status >= 500) return new AppError("PROVIDER_UNAVAILABLE", undefined, cause);
  return new AppError("PROVIDER_ERROR", undefined, cause);
}
