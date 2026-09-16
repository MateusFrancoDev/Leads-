/**
 * Cliente da Overpass API com fallback entre instâncias públicas.
 *
 * - Timeout, 429, 502, 503, 504 e "Query timed out" contam como falha
 *   transitória: a próxima tentativa vai para a instância seguinte da lista.
 * - Qualquer outro erro (consulta inválida, 400, 403) falha na hora.
 * - O total de tentativas é fixo (maxAttempts): nunca alterna para sempre.
 * - Um intervalo mínimo entre consultas evita rajadas no serviço comunitário.
 */

import { AppError } from "@/lib/errors";
import type { FetchLike } from "@/lib/leads/geocoding/nominatim";
import { MinIntervalRateLimiter } from "@/lib/leads/rate-limiter";

export interface OverpassElement {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
}

interface OverpassPayload {
  elements?: OverpassElement[];
  remark?: string;
}

export interface OverpassClientOptions {
  /** Instância principal primeiro, depois os fallbacks. */
  endpoints: readonly string[];
  timeoutMs: number;
  maxAttempts: number;
  userAgent: string;
  /** Espera antes da tentativa seguinte; dobra a cada nova falha. */
  retryDelayMs?: number;
  minIntervalMs?: number;
  fetch?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
}

export interface OverpassRunResult {
  elements: OverpassElement[];
  requests: number;
  endpoint: string;
}

const RETRYABLE_STATUS = new Set([408, 429, 502, 503, 504]);

type AttemptFailure = { retryable: boolean; rateLimited: boolean; error: AppError };

export class OverpassClient {
  private readonly options: OverpassClientOptions;
  private readonly fetchImpl: FetchLike;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly rateLimiter: MinIntervalRateLimiter;

  constructor(options: OverpassClientOptions) {
    if (options.endpoints.length === 0) throw new Error("OverpassClient precisa de ao menos uma URL.");
    this.options = options;
    this.fetchImpl = options.fetch ?? ((input, init) => fetch(input, init));
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.rateLimiter = new MinIntervalRateLimiter(options.minIntervalMs ?? 1_000);
  }

  async run(query: string): Promise<OverpassRunResult> {
    const { endpoints } = this.options;
    const maxAttempts = Math.max(1, this.options.maxAttempts);
    const baseDelay = this.options.retryDelayMs ?? 1_000;
    let lastFailure: AttemptFailure | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const endpoint = endpoints[attempt % endpoints.length];
      if (attempt > 0) await this.sleep(baseDelay * 2 ** (attempt - 1));

      const outcome = await this.rateLimiter.schedule(() => this.attempt(endpoint, query));
      if ("elements" in outcome) {
        return { elements: outcome.elements, requests: attempt + 1, endpoint };
      }

      lastFailure = outcome;
      if (!outcome.retryable) throw outcome.error;
    }

    if (lastFailure?.rateLimited) {
      throw new AppError(
        "PROVIDER_RATE_LIMITED",
        "Os servidores públicos do OpenStreetMap estão limitando consultas. Aguarde um minuto e tente de novo.",
        lastFailure.error,
      );
    }
    throw new AppError(
      "PROVIDER_UNAVAILABLE",
      "Os servidores do OpenStreetMap (Overpass) não responderam. Tente novamente em instantes.",
      lastFailure?.error,
    );
  }

  private async attempt(
    endpoint: string,
    query: string,
  ): Promise<{ elements: OverpassElement[] } | AttemptFailure> {
    let response: Response;
    try {
      response = await this.fetchImpl(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": this.options.userAgent,
          Accept: "application/json",
        },
        body: `data=${encodeURIComponent(query)}`,
        // Margem sobre o [timeout] da consulta para receber o erro do servidor.
        signal: AbortSignal.timeout(this.options.timeoutMs + 2_000),
      });
    } catch (error) {
      return { retryable: true, rateLimited: false, error: new AppError("NETWORK_ERROR", undefined, error) };
    }

    if (!response.ok) {
      const retryable = RETRYABLE_STATUS.has(response.status);
      return {
        retryable,
        rateLimited: response.status === 429,
        error: new AppError(
          retryable ? "PROVIDER_UNAVAILABLE" : "PROVIDER_ERROR",
          retryable ? undefined : `O Overpass recusou a consulta (HTTP ${response.status}).`,
        ),
      };
    }

    let payload: OverpassPayload;
    try {
      payload = (await response.json()) as OverpassPayload;
    } catch (error) {
      // Instância sobrecarregada às vezes devolve HTML de erro com status 200.
      return { retryable: true, rateLimited: false, error: new AppError("PROVIDER_UNAVAILABLE", undefined, error) };
    }

    const elements = Array.isArray(payload.elements) ? payload.elements : [];
    // Timeout ou falta de memória no servidor chegam como "remark" com status 200.
    if (payload.remark && /runtime error|timed out|out of memory/i.test(payload.remark) && elements.length === 0) {
      return { retryable: true, rateLimited: false, error: new AppError("PROVIDER_UNAVAILABLE") };
    }
    return { elements };
  }
}
