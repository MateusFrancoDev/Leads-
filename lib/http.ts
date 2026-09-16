/**
 * Utilitários de rede compartilhados. Timeout, tentativas e fallback das
 * fontes externas ficam nos próprios clientes (lib/leads/providers,
 * lib/leads/geocoding, lib/leads/enrichment/safe-fetch).
 */

/**
 * Executa em paralelo respeitando um limite de concorrência.
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
