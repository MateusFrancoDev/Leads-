/**
 * Utilitarios de rede compartilhados por todos os providers e pelo futuro
 * analisador de sites: timeout, retry com backoff e limite de concorrencia.
 * Um site fora do ar nunca pode travar uma busca inteira.
 */

import { AppError } from "@/lib/errors";

export interface FetchWithTimeoutOptions extends RequestInit {
  timeoutMs: number;
}

/** fetch com AbortSignal.timeout. Erros de rede viram AppError tipado. */
export async function fetchWithTimeout(
  url: string,
  { timeoutMs, ...init }: FetchWithTimeoutOptions,
): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    const isTimeout = error instanceof DOMException && error.name === "TimeoutError";
    throw new AppError(
      isTimeout ? "PROVIDER_UNAVAILABLE" : "NETWORK_ERROR",
      undefined,
      error,
    );
  }
}

/** Status HTTP que valem uma nova tentativa (falhas transitorias). */
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

export function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUS.has(status);
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof AppError) {
    return (
      error.code === "NETWORK_ERROR" ||
      error.code === "PROVIDER_UNAVAILABLE" ||
      error.code === "PROVIDER_RATE_LIMITED"
    );
  }
  return false;
}

export interface RetryOptions {
  /** Tentativas extras alem da primeira. */
  retries: number;
  baseDelayMs: number;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Executa com backoff exponencial simples, somente para erros transitorios.
 * Erros definitivos (chave invalida, entrada errada) falham na primeira vez.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  { retries, baseDelayMs }: RetryOptions,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === retries || !isRetryableError(error)) break;
      await sleep(baseDelayMs * 2 ** attempt);
    }
  }
  throw lastError;
}

/**
 * Executa em paralelo respeitando um limite de concorrencia.
 * Evita disparar centenas de requests de uma vez.
 */
export async function mapWithConcurrency<TInput, TOutput>(
  items: readonly TInput[],
  limit: number,
  worker: (item: TInput, index: number) => Promise<TOutput>,
): Promise<TOutput[]> {
  if (items.length === 0) return [];
  const results = new Array<TOutput>(items.length);
  const size = Math.max(1, Math.min(limit, items.length));
  let cursor = 0;

  const runners = Array.from({ length: size }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  });

  await Promise.all(runners);
  return results;
}
