/**
 * Log centralizado. Em produção só registra warn/error e nunca imprime
 * dados sensíveis (chaves, URLs com token) — passe apenas contexto útil.
 */

type LogContext = Record<string, string | number | boolean | null | undefined>;

const isDev = process.env.NODE_ENV !== "production";

function format(scope: string, message: string, context?: LogContext): string {
  if (!context) return `[${scope}] ${message}`;
  const pairs = Object.entries(context)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(" ");
  return pairs ? `[${scope}] ${message} ${pairs}` : `[${scope}] ${message}`;
}

export function createLogger(scope: string) {
  return {
    debug(message: string, context?: LogContext) {
      if (isDev) console.debug(format(scope, message, context));
    },
    info(message: string, context?: LogContext) {
      if (isDev) console.info(format(scope, message, context));
    },
    warn(message: string, context?: LogContext) {
      console.warn(format(scope, message, context));
    },
    error(message: string, context?: LogContext) {
      console.error(format(scope, message, context));
    },
  };
}

export type Logger = ReturnType<typeof createLogger>;
