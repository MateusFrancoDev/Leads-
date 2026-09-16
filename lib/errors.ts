/**
 * Erros da aplicação com código estável, para que a UI diferencie
 * "nenhum resultado" de "provider fora do ar" sem expor stack trace.
 */

export const APP_ERROR_CODES = [
  "INVALID_INPUT",
  "NOT_FOUND",
  "PROVIDER_NOT_CONFIGURED",
  "PROVIDER_ERROR",
  "PROVIDER_RATE_LIMITED",
  "PROVIDER_UNAVAILABLE",
  "NETWORK_ERROR",
  "DATABASE_ERROR",
  "UNKNOWN",
] as const;

export type AppErrorCode = (typeof APP_ERROR_CODES)[number];

/** Mensagens exibidas ao usuário. Nunca contêm detalhe técnico. */
export const APP_ERROR_MESSAGES: Record<AppErrorCode, string> = {
  INVALID_INPUT: "Os dados informados não são válidos. Revise os filtros e tente de novo.",
  NOT_FOUND: "Não encontramos esse registro.",
  PROVIDER_NOT_CONFIGURED:
    "A fonte de empresas está desligada. Confira LEAD_PROVIDER e OPENSTREETMAP_ENABLED no .env.",
  PROVIDER_ERROR: "A fonte de dados recusou a consulta. Tente novamente em instantes.",
  PROVIDER_RATE_LIMITED: "Limite de consultas da fonte de dados atingido. Aguarde alguns minutos.",
  PROVIDER_UNAVAILABLE: "A fonte de dados esta indisponível no momento.",
  NETWORK_ERROR: "Falha de conexão ao consultar a fonte de dados.",
  DATABASE_ERROR: "Não foi possível acessar o banco de dados.",
  UNKNOWN: "Algo deu errado. Tente novamente.",
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly cause?: unknown;
  /**
   * Explicação específica desta ocorrência, quando ela ajuda mais que a
   * mensagem genérica do código. Continua sendo texto seguro para exibir.
   */
  readonly detail?: string;

  constructor(code: AppErrorCode, message?: string, cause?: unknown) {
    super(message ?? APP_ERROR_MESSAGES[code]);
    this.name = "AppError";
    this.code = code;
    this.cause = cause;
    this.detail = message;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/** Converte qualquer erro capturado em AppError, preservando o código quando já houver. */
export function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error;
  if (error instanceof Error) return new AppError("UNKNOWN", undefined, error);
  return new AppError("UNKNOWN");
}

/** Mensagem segura para renderizar na interface. */
export function userMessage(error: unknown): string {
  const appError = toAppError(error);
  return appError.detail ?? APP_ERROR_MESSAGES[appError.code];
}
