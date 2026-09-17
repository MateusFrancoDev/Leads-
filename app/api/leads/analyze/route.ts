/**
 * POST /api/leads/analyze - analisa vários leads selecionados.
 *
 * Responde em NDJSON (um objeto JSON por linha) enquanto o lote roda, para a
 * interface poder mostrar "Analisando 7 de 20" sem esperar o fim. É por isso
 * que o lote não é uma Server Action: elas só respondem quando terminam.
 *
 * O teto de chamadas simultâneas e a pré-qualificação ficam no serviço, do
 * lado do servidor - o navegador não decide quanto se gasta.
 */

import { z } from "zod";
import { userMessage } from "@/lib/errors";
import { createLogger } from "@/lib/logger";
import { errorCode, errorResponse } from "@/server/api/errors";
import { analyzeLeadsInBatch, MAX_BATCH_SIZE } from "@/server/services/lead-ai-service";

const logger = createLogger("api-leads-analyze");

const bodySchema = z.object({
  ids: z.array(z.string().min(1).max(40)).min(1).max(MAX_BATCH_SIZE),
  force: z.boolean().default(false),
});

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return errorResponse(415, "UNSUPPORTED_MEDIA_TYPE", "Envie o corpo como application/json.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "INVALID_JSON", "JSON inválido.");
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      400,
      "INVALID_INPUT",
      `Selecione de 1 a ${MAX_BATCH_SIZE} leads para analisar.`,
    );
  }

  const { ids, force } = parsed.data;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      };

      send({ type: "start", total: ids.length });

      try {
        const outcome = await analyzeLeadsInBatch(ids, {
          force,
          onResult: (result, done, total) => send({ type: "result", done, total, ...result }),
        });
        // A listagem é force-dynamic e o cliente recarrega ao fim do lote:
        // não há cache a invalidar daqui de dentro do stream.
        send({
          type: "done",
          analyzed: outcome.analyzed,
          reused: outcome.reused,
          skipped: outcome.skipped,
          failed: outcome.failed,
        });
      } catch (error) {
        // Falha que derruba o lote inteiro (IA desligada, banco fora): vira uma
        // linha de erro com mensagem segura, nunca uma página quebrada.
        logger.error("falha no lote", { code: errorCode(error) });
        send({ type: "error", message: userMessage(error) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      // Garante que o progresso chegue linha a linha, sem buffer intermediário.
      "X-Accel-Buffering": "no",
    },
  });
}
