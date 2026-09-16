/**
 * Varre um CSV grande em streaming entregando só as linhas que interessam.
 *
 * Os arquivos de Estabelecimentos somam dezenas de milhões de linhas. Quando
 * há um filtro textual (UF + código do município), um bloco de 1 MB que não
 * contém nenhum dos trechos é descartado inteiro, sem dividir em linhas.
 */

import type { Readable } from "node:stream";

export interface ScanOptions {
  /** Trechos que a linha precisa conter. Sem trechos, toda linha é entregue. */
  needles?: readonly string[];
  onLine: (line: string) => void;
  /** Chamado a cada bloco lido, com o total de bytes de texto processados. */
  onProgress?: (processedChars: number) => void;
}

export async function scanLines(stream: Readable, { needles = [], onLine, onProgress }: ScanOptions): Promise<void> {
  stream.setEncoding("latin1");
  let carry = "";
  let processed = 0;

  const hasNeedle = (text: string) => needles.length === 0 || needles.some((needle) => text.includes(needle));

  const emit = (block: string) => {
    if (!hasNeedle(block)) return;
    for (const line of block.split("\n")) {
      if (line && hasNeedle(line)) onLine(line);
    }
  };

  for await (const chunk of stream as AsyncIterable<string>) {
    processed += chunk.length;
    const data = carry + chunk;
    const lastBreak = data.lastIndexOf("\n");
    if (lastBreak === -1) {
      carry = data;
      continue;
    }
    emit(data.slice(0, lastBreak));
    carry = data.slice(lastBreak + 1);
    onProgress?.(processed);
  }
  if (carry) emit(carry);
}
