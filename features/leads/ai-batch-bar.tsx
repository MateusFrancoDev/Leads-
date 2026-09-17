"use client";

/**
 * Barra de análise em lote da tabela de leads.
 *
 * Lê as checkboxes da própria tabela (as mesmas que a exportação usa - uma
 * seleção só, não duas) e consome `POST /api/leads/analyze`, que devolve um
 * resultado por linha enquanto processa. É daí que sai o "Analisando 7 de 20":
 * o progresso é real, não uma animação.
 *
 * O teto de chamadas simultâneas fica no servidor. Aqui só existe uma
 * requisição, então o navegador não tem como disparar dezenas de análises.
 */

import { useRef, useState } from "react";
import { Brain } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Progress {
  done: number;
  total: number;
}

interface Summary {
  analyzed: number;
  reused: number;
  skipped: number;
  failed: number;
}

/** Uma linha do NDJSON, como o servidor a envia. */
type StreamLine =
  | { type: "start"; total: number }
  | { type: "result"; done: number; total: number; status: string; message: string }
  | ({ type: "done" } & Summary)
  | { type: "error"; message: string };

function summaryText(summary: Summary): string {
  const parts = [`${summary.analyzed} analisado(s)`];
  if (summary.reused > 0) parts.push(`${summary.reused} reaproveitado(s)`);
  if (summary.skipped > 0) parts.push(`${summary.skipped} sem dados suficientes`);
  if (summary.failed > 0) parts.push(`${summary.failed} com falha`);
  return `${parts.join(", ")}.`;
}

export function AiBatchBar({ maxBatchSize }: { maxBatchSize: number }) {
  const anchor = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  /** Ids marcados na tabela, lidos do formulário que envolve a barra. */
  function selectedIds(): string[] {
    const form = anchor.current?.closest("form");
    if (!form) return [];
    return [...form.querySelectorAll<HTMLInputElement>('input[name="ids"]:checked')].map(
      (input) => input.value,
    );
  }

  async function run() {
    const ids = selectedIds();
    setFailed(false);

    if (ids.length === 0) {
      setMessage("Marque ao menos um lead para analisar.");
      setFailed(true);
      return;
    }
    if (ids.length > maxBatchSize) {
      setMessage(`Selecione no máximo ${maxBatchSize} leads por vez.`);
      setFailed(true);
      return;
    }

    setProgress({ done: 0, total: ids.length });
    setMessage(null);

    try {
      const response = await fetch("/api/leads/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids }),
      });

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => null);
        throw new Error(
          payload?.error?.message ?? "Não foi possível analisar estes leads no momento.",
        );
      }

      // `failed` do estado ainda não valeria aqui (o React só reagenda depois):
      // a decisão de recarregar usa o que o stream acabou de dizer.
      let batchFailed = false;

      await readStream(response.body, (line) => {
        if (line.type === "result") setProgress({ done: line.done, total: line.total });
        if (line.type === "done") setMessage(summaryText(line));
        if (line.type === "error") {
          batchFailed = true;
          setMessage(line.message);
          setFailed(true);
        }
      });

      // Os scores novos vêm do servidor: recarrega a listagem já analisada.
      if (!batchFailed) window.location.reload();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Não foi possível analisar estes leads no momento.",
      );
      setFailed(true);
    } finally {
      setProgress(null);
    }
  }

  const running = progress !== null;

  return (
    <div ref={anchor} className="flex flex-wrap items-center gap-2">
      <Button type="button" size="sm" variant="secondary" onClick={run} disabled={running}>
        <Brain className="size-3.5" aria-hidden />
        {running ? "Analisando..." : "Analisar selecionados com IA"}
      </Button>

      {running ? (
        <p role="status" className="text-xs text-ink-muted">
          Analisando {Math.min(progress.done + 1, progress.total)} de {progress.total}...
        </p>
      ) : null}

      {!running && message ? (
        <p role="status" className={failed ? "text-xs text-negative" : "text-xs text-positive"}>
          {message}
        </p>
      ) : null}
    </div>
  );
}

/** Lê o NDJSON linha a linha, sem esperar o fim da resposta. */
async function readStream(
  body: ReadableStream<Uint8Array>,
  onLine: (line: StreamLine) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // A última parte pode estar incompleta: fica no buffer até chegar o \n.
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        onLine(JSON.parse(line) as StreamLine);
      } catch {
        // Linha truncada não interrompe o lote: o resumo final ainda chega.
      }
    }
  }
}
