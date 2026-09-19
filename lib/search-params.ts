/**
 * Leitura de query string. O Next entrega `string | string[] | undefined`
 * porque "?aba=a&aba=b" é possível; quase toda tela quer só um valor.
 */

export type RawSearchParams = Record<string, string | string[] | undefined>;

/** Primeiro valor do parâmetro, ou o padrão. */
export function readParam(params: RawSearchParams, key: string, fallback: string): string {
  const value = params[key];
  const single = Array.isArray(value) ? value[0] : value;
  return single && single.trim() !== "" ? single : fallback;
}

/** Igual a readParam, mas sem padrão: devolve undefined quando não veio nada. */
export function optionalParam(params: RawSearchParams, key: string): string | undefined {
  const value = params[key];
  const single = Array.isArray(value) ? value[0] : value;
  return single && single.trim() !== "" ? single : undefined;
}
