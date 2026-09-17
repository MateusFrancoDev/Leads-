/**
 * Tradução de erro da aplicação em resposta HTTP, compartilhada pelas rotas.
 *
 * A resposta leva apenas o código estável e a mensagem segura de `lib/errors`:
 * nada de stack trace, nada de detalhe do provider e, em especial, nada de
 * chave de API - mesmo quando o erro veio de uma chave recusada.
 */

import { isAppError, userMessage, type AppErrorCode } from "@/lib/errors";

const STATUS_BY_CODE: Partial<Record<AppErrorCode, number>> = {
  INVALID_INPUT: 400,
  NOT_FOUND: 404,
  PROVIDER_NOT_CONFIGURED: 503,
  PROVIDER_RATE_LIMITED: 429,
  PROVIDER_UNAVAILABLE: 503,
  PROVIDER_ERROR: 502,
  NETWORK_ERROR: 502,
  DATABASE_ERROR: 503,
};

export function errorResponse(
  status: number,
  code: string,
  message: string,
  details?: unknown,
): Response {
  return Response.json({ error: { code, message, ...(details ? { details } : {}) } }, { status });
}

/** Resposta pronta para um erro capturado, com o status que combina com o código. */
export function appErrorResponse(error: unknown): Response {
  const code: AppErrorCode = isAppError(error) ? error.code : "UNKNOWN";
  return errorResponse(STATUS_BY_CODE[code] ?? 500, code, userMessage(error));
}

/** Código estável do erro, para o log do servidor. */
export function errorCode(error: unknown): AppErrorCode {
  return isAppError(error) ? error.code : "UNKNOWN";
}
